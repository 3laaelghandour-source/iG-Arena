import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import WebSocket, { WebSocketServer } from "ws";
import { resolve } from "node:path";
import { PlayerStore } from "./playerStore.js";
import {
  AVAILABLE_MAPS,
  MODE_RULES,
  parseIncomingMessage,
  sanitizeDisplayName,
  validateQueueRequest
} from "./protocol.js";

const PORT = Number(process.env.PORT ?? 8080);
const READY_TIMEOUT_MS = 45_000;
const HEARTBEAT_MS = 25_000;
const MAX_CONNECTIONS_PER_IP = 4;
const MAX_MESSAGES_PER_SECOND = 25;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)
);

const playerStore = new PlayerStore(resolve(process.env.DATA_DIR ?? "./data", "players.json"));

const sessions = new Map();
const queues = new Map();
const rooms = new Map();
const activeByIp = new Map();
const authAttempts = new Map();

function send(session, type, payload = {}) {
  if (session?.socket.readyState !== WebSocket.OPEN) return;
  session.socket.send(JSON.stringify({ type, ...payload }));
}

function sendError(session, code) {
  send(session, "server.error", { code });
}

function getQueueKey(mode, mapId) {
  return mode + ":" + mapId;
}

function getQueue(queueKey) {
  if (!queues.has(queueKey)) queues.set(queueKey, []);
  return queues.get(queueKey);
}

function broadcastQueue(queueKey) {
  const queue = getQueue(queueKey).filter((playerId) => {
    const session = sessions.get(playerId);
    return session && session.queueKey === queueKey;
  });
  queues.set(queueKey, queue);

  const [mode, mapId] = queueKey.split(":");
  const rules = MODE_RULES[mode];
  queue.forEach((playerId, index) => {
    const session = sessions.get(playerId);
    send(session, "queue.status", {
      mode,
      mapId,
      position: index + 1,
      playersWaiting: queue.length,
      playersNeeded: Math.max(0, rules.minPlayers - queue.length)
    });
  });
}

function broadcastRoom(room, type, payload = {}) {
  for (const playerId of room.playerIds) {
    send(sessions.get(playerId), type, payload);
  }
}

function roomSnapshot(room) {
  return {
    roomId: room.id,
    mode: room.mode,
    mapId: room.mapId,
    phase: room.phase,
    players: room.playerIds.map((playerId) => {
      const session = sessions.get(playerId);
      const player = room.players.get(playerId);
      return {
        id: playerId,
        displayName: session?.displayName ?? player.displayName,
        team: player.team,
        ready: player.ready,
        connected: Boolean(session)
      };
    }),
    minimumPlayers: MODE_RULES[room.mode].minPlayers
  };
}

function removeFromQueue(session) {
  if (!session.queueKey) return;
  const queueKey = session.queueKey;
  const queue = getQueue(queueKey).filter((playerId) => playerId !== session.playerId);
  queues.set(queueKey, queue);
  session.queueKey = null;
  broadcastQueue(queueKey);
}

function cancelRoom(room, reason, leaverId = null) {
  if (!room || !rooms.has(room.id)) return;
  clearTimeout(room.readyTimer);

  for (const playerId of room.playerIds) {
    const session = sessions.get(playerId);
    if (session) {
      session.roomId = null;
      send(session, "room.cancelled", { roomId: room.id, reason, leaverId });
    }
  }

  rooms.delete(room.id);
}

function createRoom(queueKey) {
  const [mode, mapId] = queueKey.split(":");
  const rules = MODE_RULES[mode];
  const queue = getQueue(queueKey);
  const selectedIds = queue.splice(0, Math.min(rules.maxPlayers, queue.length));
  if (selectedIds.length < rules.minPlayers) return;

  const room = {
    id: randomUUID(),
    mode,
    mapId,
    phase: "staging",
    playerIds: selectedIds,
    players: new Map(),
    readyTimer: null,
    createdAt: Date.now()
  };

  selectedIds.forEach((playerId, index) => {
    const session = sessions.get(playerId);
    if (!session) return;
    session.queueKey = null;
    session.roomId = room.id;
    room.players.set(playerId, {
      team: rules.teamBased ? (index % 2 === 0 ? "red" : "blue") : null,
      ready: false
    });
  });

  room.playerIds = room.playerIds.filter((playerId) => room.players.has(playerId));
  if (room.playerIds.length < rules.minPlayers) {
    for (const playerId of room.playerIds) {
      const session = sessions.get(playerId);
      if (session) session.roomId = null;
    }
    return;
  }

  rooms.set(room.id, room);
  const snapshot = roomSnapshot(room);
  broadcastRoom(room, "match.found", snapshot);
  broadcastQueue(queueKey);

  room.readyTimer = setTimeout(() => cancelRoom(room, "ready-timeout"), READY_TIMEOUT_MS);
  room.readyTimer.unref?.();
}

function dispatchQueue(queueKey) {
  const [mode] = queueKey.split(":");
  const minimum = MODE_RULES[mode].minPlayers;
  while (getQueue(queueKey).length >= minimum) createRoom(queueKey);
  broadcastQueue(queueKey);
}

function joinQueue(session, payload) {
  if (session.roomId) {
    sendError(session, "already-in-room");
    return;
  }

  let request;
  try {
    request = validateQueueRequest(payload);
  } catch (error) {
    sendError(session, error.message || "invalid-queue-request");
    return;
  }

  removeFromQueue(session);
  session.displayName = request.displayName;
  const queueKey = getQueueKey(request.mode, request.mapId);
  session.queueKey = queueKey;
  getQueue(queueKey).push(session.playerId);
  broadcastQueue(queueKey);
  dispatchQueue(queueKey);
}

function leaveRoom(session) {
  if (!session.roomId) return;
  const room = rooms.get(session.roomId);
  if (!room) {
    session.roomId = null;
    return;
  }
  cancelRoom(room, "player-left", session.playerId);
}

function setReady(session) {
  const room = rooms.get(session.roomId);
  if (!room || room.phase !== "staging") {
    sendError(session, "room-not-available");
    return;
  }

  const player = room.players.get(session.playerId);
  if (!player) {
    sendError(session, "player-not-in-room");
    return;
  }

  player.ready = true;
  const snapshot = roomSnapshot(room);
  broadcastRoom(room, "room.snapshot", snapshot);

  if (room.playerIds.every((playerId) => room.players.get(playerId)?.ready)) {
    clearTimeout(room.readyTimer);
    room.phase = "launch-ready";
    broadcastRoom(room, "room.launch-ready", {
      ...roomSnapshot(room),
      notice: "All players are ready. This room is waiting for the gameplay runtime."
    });
  }
}

function setDisplayName(session, value) {
  session.displayName = sanitizeDisplayName(value, session.displayName);
  const room = rooms.get(session.roomId);
  if (room) broadcastRoom(room, "room.snapshot", roomSnapshot(room));
  send(session, "profile.name-updated", { displayName: session.displayName });
}

function handleMessage(session, raw) {
  let message;
  try {
    message = parseIncomingMessage(raw);
  } catch (error) {
    sendError(session, error.message || "invalid-message");
    return;
  }

  switch (message.type) {
    case "profile.set-name":
      setDisplayName(session, message.displayName);
      break;
    case "queue.join":
      joinQueue(session, message);
      break;
    case "queue.leave":
      removeFromQueue(session);
      send(session, "queue.left");
      break;
    case "room.ready":
      setReady(session);
      break;
    case "room.leave":
      leaveRoom(session);
      break;
    case "client.ping":
      send(session, "server.pong", { at: Date.now() });
      break;
    default:
      sendError(session, "unknown-message-type");
  }
}

function isOriginAllowed(origin) {
  if (!origin || allowedOrigins.has(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (!isOriginAllowed(origin)) return false;
  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return true;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function readJsonBody(request) {
  const contentType = String(request.headers["content-type"] ?? "");
  if (!contentType.toLowerCase().includes("application/json")) {
    throw httpError("content-type-must-be-json", 415);
  }
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (declaredLength > 8 * 1024) throw httpError("request-too-large", 413);

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8 * 1024) throw httpError("request-too-large", 413);
    chunks.push(chunk);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError("invalid-json", 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw httpError("invalid-json-object", 400);
  }
  return payload;
}

function getBearerToken(request) {
  const header = String(request.headers.authorization ?? "");
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(header);
  return match?.[1] ?? null;
}

function allowAuthAttempt(ip) {
  const now = Date.now();
  const existing = authAttempts.get(ip);
  if (!existing || now - existing.startedAt >= 60_000) {
    authAttempts.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  if (existing.count >= 10) return false;
  existing.count += 1;
  return true;
}

function getAuthErrorStatus(error) {
  if (error?.statusCode) return error.statusCode;
  if (error?.message === "username-taken") return 409;
  if (error?.message === "invalid-credentials") return 401;
  if (["invalid-username", "invalid-password", "invalid-outcome", "invalid-points"].includes(error?.message)) return 400;
  if (error?.message === "player-not-found") return 404;
  return 500;
}

async function handleHttpRequest(request, response) {
  if (!applyCors(request, response)) {
    sendJson(response, 403, { error: "origin-not-allowed" });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, {
      status: "ok",
      service: "ig-arena-game-service",
      connectedPlayers: sessions.size,
      activeRooms: rooms.size,
      availableMaps: [...AVAILABLE_MAPS],
      playerStore: "ready"
    });
    return;
  }

  const isAuthRoute = request.method === "POST" &&
    ["/api/auth/register", "/api/auth/login"].includes(url.pathname);

  if (isAuthRoute) {
    const ip = request.socket.remoteAddress ?? "unknown";
    if (!allowAuthAttempt(ip)) {
      sendJson(response, 429, { error: "auth-rate-limit" });
      return;
    }

    const body = await readJsonBody(request);
    const result = url.pathname.endsWith("/register")
      ? await playerStore.register(body.username, body.password)
      : await playerStore.login(body.username, body.password);
    sendJson(response, url.pathname.endsWith("/register") ? 201 : 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    await playerStore.logout(getBearerToken(request));
    response.writeHead(204, { "cache-control": "no-store" });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/me") {
    const profile = await playerStore.getProfile(getBearerToken(request));
    if (!profile) {
      sendJson(response, 401, { error: "not-authenticated" });
      return;
    }
    sendJson(response, 200, { profile });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/leaderboard") {
    const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
    sendJson(response, 200, { players: playerStore.getLeaderboard(requestedLimit) });
    return;
  }

  sendJson(response, 404, { error: "not-found" });
}

const httpServer = createServer((request, response) => {
  void handleHttpRequest(request, response).catch((error) => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const status = getAuthErrorStatus(error);
    const safeError = status === 500 ? "internal-error" : error.message;
    sendJson(response, status, { error: safeError });
  });
});

const webSocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 8 * 1024,
  perMessageDeflate: false
});

httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const origin = request.headers.origin;
  const originAllowed = isOriginAllowed(origin);

  if (url.pathname !== "/ws" || !originAllowed) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const ip = request.socket.remoteAddress ?? "unknown";
  if ((activeByIp.get(ip) ?? 0) >= MAX_CONNECTIONS_PER_IP) {
    socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit("connection", webSocket, request, ip);
  });
});

webSocketServer.on("connection", (socket, request, ip) => {
  const playerId = randomUUID();
  const session = {
    playerId,
    displayName: "Guest-" + playerId.slice(0, 4).toUpperCase(),
    socket,
    queueKey: null,
    roomId: null,
    alive: true,
    messageWindowAt: Date.now(),
    messageCount: 0,
    ip
  };

  sessions.set(playerId, session);
  activeByIp.set(ip, (activeByIp.get(ip) ?? 0) + 1);
  send(session, "server.hello", {
    playerId,
    displayName: session.displayName,
    guestSession: true
  });

  socket.on("pong", () => { session.alive = true; });
  socket.on("message", (raw) => {
    const now = Date.now();
    if (now - session.messageWindowAt >= 1_000) {
      session.messageWindowAt = now;
      session.messageCount = 0;
    }
    session.messageCount += 1;
    if (session.messageCount > MAX_MESSAGES_PER_SECOND) {
      socket.close(1008, "rate-limit");
      return;
    }
    handleMessage(session, raw);
  });

  socket.on("close", () => {
    removeFromQueue(session);
    leaveRoom(session);
    sessions.delete(playerId);
    const remaining = Math.max(0, (activeByIp.get(ip) ?? 1) - 1);
    if (remaining === 0) activeByIp.delete(ip);
    else activeByIp.set(ip, remaining);
  });

  socket.on("error", () => {
    socket.terminate();
  });
});

const heartbeat = setInterval(() => {
  for (const socket of webSocketServer.clients) {
    if (socket.readyState !== WebSocket.OPEN) continue;
    const session = [...sessions.values()].find((entry) => entry.socket === socket);
    if (session && !session.alive) {
      socket.terminate();
      continue;
    }
    if (session) session.alive = false;
    socket.ping();
  }
}, HEARTBEAT_MS);
heartbeat.unref?.();

await playerStore.initialize();

httpServer.listen(PORT, "0.0.0.0", () => {
  process.stdout.write("iG Arena game service listening on port " + PORT + "\n");
});

function shutdown() {
  clearInterval(heartbeat);
  for (const room of rooms.values()) cancelRoom(room, "server-shutdown");
  for (const socket of webSocketServer.clients) socket.close(1001, "server-shutdown");
  httpServer.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
