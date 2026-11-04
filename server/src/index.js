import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import WebSocket, { WebSocketServer } from "ws";
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

const sessions = new Map();
const queues = new Map();
const rooms = new Map();
const activeByIp = new Map();

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

const httpServer = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      status: "ok",
      service: "ig-arena-game-service",
      connectedPlayers: sessions.size,
      activeRooms: rooms.size,
      availableMaps: [...AVAILABLE_MAPS]
    }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "not-found" }));
});

const webSocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 8 * 1024,
  perMessageDeflate: false
});

httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const origin = request.headers.origin;
  const originAllowed = !origin
    ? true
    : allowedOrigins.size > 0
      ? allowedOrigins.has(origin)
      : process.env.NODE_ENV !== "production";

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
