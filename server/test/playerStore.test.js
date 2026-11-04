import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlayerStore } from "../src/playerStore.js";

async function withStore(run) {
  const directory = await mkdtemp(join(tmpdir(), "ig-arena-store-"));
  try {
    const store = new PlayerStore(join(directory, "players.json"));
    await store.initialize();
    await run(store, join(directory, "players.json"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("registers an account without exposing password material", async () => {
  await withStore(async (store) => {
    const result = await store.register("Arena_Player", "secure-pass-123");
    assert.equal(result.profile.username, "Arena_Player");
    assert.equal(result.profile.stats.matchesPlayed, 0);
    assert.equal(typeof result.token, "string");
    assert.equal("passwordHash" in result.profile, false);
    assert.equal("passwordSalt" in result.profile, false);
  });
});

test("rejects invalid usernames, short passwords and duplicate names", async () => {
  await withStore(async (store) => {
    await assert.rejects(store.register("ab", "secure-pass-123"), /invalid-username/);
    await assert.rejects(store.register("valid_name", "short"), /invalid-password/);
    await store.register("Valid_Name", "secure-pass-123");
    await assert.rejects(store.register("valid_name", "another-pass-123"), /username-taken/);
  });
});

test("authenticates, persists sessions and supports logout", async () => {
  await withStore(async (store, filePath) => {
    const created = await store.register("player01", "secure-pass-123");
    await assert.rejects(store.login("player01", "incorrect-password"), /invalid-credentials/);

    const restarted = new PlayerStore(filePath);
    await restarted.initialize();
    const profile = await restarted.getProfile(created.token);
    assert.equal(profile.username, "player01");

    await restarted.logout(created.token);
    assert.equal(await restarted.getProfile(created.token), null);
  });
});

test("records results and returns a ranked public leaderboard", async () => {
  await withStore(async (store) => {
    await store.register("runner01", "secure-pass-123");
    await store.register("runner02", "secure-pass-456");
    await store.recordMatchResult("runner02", { outcome: "win", points: 120 });
    await store.recordMatchResult("runner01", { outcome: "draw", points: 40 });

    const board = store.getLeaderboard();
    assert.equal(board[0].username, "runner02");
    assert.equal(board[0].stats.xp, 170);
    assert.equal(board[1].username, "runner01");
    assert.equal(board[1].stats.xp, 60);
  });
});
