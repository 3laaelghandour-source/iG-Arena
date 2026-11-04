import test from "node:test";
import assert from "node:assert/strict";
import {
  parseIncomingMessage,
  sanitizeDisplayName,
  validateQueueRequest
} from "../src/protocol.js";

test("accepts a supported Arena queue request", () => {
  const request = validateQueueRequest({
    mode: "arena",
    mapId: "foundry",
    displayName: "Player One"
  });
  assert.deepEqual(request, {
    mode: "arena",
    mapId: "foundry",
    displayName: "Player One"
  });
});

test("rejects unsupported playlists, prototype keys and maps", () => {
  for (const mode of ["unknown", "__proto__", "constructor", "toString"]) {
    assert.throws(
      () => validateQueueRequest({ mode, mapId: "foundry" }),
      /unsupported-mode/
    );
  }
  assert.throws(() => validateQueueRequest({ mode: "arena", mapId: "unknown" }), /unsupported-map/);
});

test("cleans player names and applies a length limit", () => {
  assert.equal(sanitizeDisplayName("<b>Player</b>"), "bPlayerb");
  assert.equal(sanitizeDisplayName("A".repeat(40)).length, 20);
});

test("accepts structured messages and rejects malformed JSON", () => {
  assert.deepEqual(parseIncomingMessage('{"type":"queue.leave"}'), { type: "queue.leave" });
  assert.throws(() => parseIncomingMessage("{bad-json"), /invalid-json/);
});
