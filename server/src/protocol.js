export const MODE_RULES = Object.freeze({
  arena: Object.freeze({ minPlayers: 4, maxPlayers: 6, teamBased: true }),
  deathmatch: Object.freeze({ minPlayers: 2, maxPlayers: 6, teamBased: false })
});

export const AVAILABLE_MAPS = new Set(["foundry", "district", "overpass"]);
export const MAX_MESSAGE_BYTES = 8 * 1024;

export function sanitizeDisplayName(value, fallback = "Guest") {
  const cleaned = String(value ?? "")
    .normalize("NFKC")
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}_ .-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
  return cleaned || fallback;
}

export function validateQueueRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid-payload");
  }

  const mode = payload.mode;
  const mapId = payload.mapId;

  if (typeof mode !== "string" || !Object.hasOwn(MODE_RULES, mode)) {
    throw new Error("unsupported-mode");
  }
  if (typeof mapId !== "string" || !AVAILABLE_MAPS.has(mapId)) {
    throw new Error("unsupported-map");
  }

  return {
    mode,
    mapId,
    displayName: sanitizeDisplayName(payload.displayName)
  };
}

export function parseIncomingMessage(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  if (Buffer.byteLength(text, "utf8") > MAX_MESSAGE_BYTES) throw new Error("message-too-large");

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("invalid-json");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid-message");
  }
  if (typeof payload.type !== "string" || !/^[a-z][a-z0-9.]{0,39}$/.test(payload.type)) {
    throw new Error("invalid-message-type");
  }

  return payload;
}
