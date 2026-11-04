import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,16}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const DUMMY_SALT = Buffer.alloc(16, 23);

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function emptyStats() {
  return {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    xp: 0,
    lastMatchAt: null
  };
}

function publicProfile(account) {
  return {
    username: account.username,
    createdAt: account.createdAt,
    stats: { ...account.stats }
  };
}

export class PlayerStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { schemaVersion: 1, accounts: {}, sessions: {} };
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (
        parsed?.schemaVersion !== 1 ||
        !parsed.accounts || typeof parsed.accounts !== "object" ||
        !parsed.sessions || typeof parsed.sessions !== "object"
      ) {
        throw new Error("Player data file has an unsupported or invalid format.");
      }
      this.state = parsed;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await this.persist();
    }

    const now = Date.now();
    let removedExpired = false;
    for (const [tokenHash, session] of Object.entries(this.state.sessions)) {
      if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
        delete this.state.sessions[tokenHash];
        removedExpired = true;
      }
    }
    if (removedExpired) await this.persist();
  }

  async register(username, password) {
    return this.exclusive(async () => {
      const cleanUsername = this.validateUsername(username);
      this.validatePassword(password);
      const key = cleanUsername.toLowerCase();
      if (this.state.accounts[key]) throw new Error("username-taken");

      const salt = randomBytes(16);
      const passwordHash = await scrypt(password, salt, 64, {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024
      });

      const account = {
        username: cleanUsername,
        passwordSalt: salt.toString("base64"),
        passwordHash: Buffer.from(passwordHash).toString("base64"),
        createdAt: new Date().toISOString(),
        stats: emptyStats()
      };

      this.state.accounts[key] = account;
      const token = this.createSession(key);
      await this.persist();
      return { token, profile: publicProfile(account) };
    });
  }

  async login(username, password) {
    return this.exclusive(async () => {
      const value = typeof username === "string" ? username.trim() : "";
      const key = value.toLowerCase();
      const account = this.state.accounts[key];

      if (typeof password !== "string" || password.length > PASSWORD_MAX_LENGTH) {
        throw new Error("invalid-credentials");
      }

      const salt = account ? Buffer.from(account.passwordSalt, "base64") : DUMMY_SALT;
      const expected = account ? Buffer.from(account.passwordHash, "base64") : Buffer.alloc(64);
      const actual = Buffer.from(await scrypt(password, salt, 64, {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024
      }));

      if (!account || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw new Error("invalid-credentials");
      }

      const token = this.createSession(key);
      await this.persist();
      return { token, profile: publicProfile(account) };
    });
  }

  async getProfile(token) {
    if (typeof token !== "string" || token.length < 32 || token.length > 128) return null;
    const tokenHash = hashToken(token);
    const session = this.state.sessions[tokenHash];
    if (!session) return null;

    if (session.expiresAt <= Date.now()) {
      await this.exclusive(async () => {
        delete this.state.sessions[tokenHash];
        await this.persist();
      });
      return null;
    }

    const account = this.state.accounts[session.accountKey];
    return account ? publicProfile(account) : null;
  }

  async logout(token) {
    if (typeof token !== "string" || token.length < 32 || token.length > 128) return;
    await this.exclusive(async () => {
      delete this.state.sessions[hashToken(token)];
      await this.persist();
    });
  }

  getLeaderboard(limit = 20) {
    const safeLimit = Math.min(50, Math.max(1, Number.isInteger(limit) ? limit : 20));
    return Object.values(this.state.accounts)
      .sort((a, b) =>
        b.stats.xp - a.stats.xp ||
        b.stats.wins - a.stats.wins ||
        b.stats.points - a.stats.points ||
        a.username.localeCompare(b.username)
      )
      .slice(0, safeLimit)
      .map((account, index) => ({
        rank: index + 1,
        username: account.username,
        stats: {
          matchesPlayed: account.stats.matchesPlayed,
          wins: account.stats.wins,
          points: account.stats.points,
          xp: account.stats.xp
        }
      }));
  }

  async recordMatchResult(username, result) {
    return this.exclusive(async () => {
      const key = String(username ?? "").trim().toLowerCase();
      const account = this.state.accounts[key];
      if (!account) throw new Error("player-not-found");

      const outcome = result?.outcome;
      const points = result?.points;
      if (!["win", "loss", "draw"].includes(outcome)) throw new Error("invalid-outcome");
      if (!Number.isInteger(points) || points < 0 || points > 100000) {
        throw new Error("invalid-points");
      }

      account.stats.matchesPlayed += 1;
      account.stats[outcome === "win" ? "wins" : outcome === "loss" ? "losses" : "draws"] += 1;
      account.stats.points += points;
      account.stats.xp += points + (outcome === "win" ? 50 : outcome === "draw" ? 20 : 0);
      account.stats.lastMatchAt = new Date().toISOString();
      await this.persist();
      return publicProfile(account);
    });
  }

  validateUsername(username) {
    if (typeof username !== "string") throw new Error("invalid-username");
    const clean = username.trim();
    if (!USERNAME_PATTERN.test(clean)) throw new Error("invalid-username");
    return clean;
  }

  validatePassword(password) {
    if (
      typeof password !== "string" ||
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      throw new Error("invalid-password");
    }
  }

  createSession(accountKey) {
    const token = randomBytes(32).toString("base64url");
    this.state.sessions[hashToken(token)] = {
      accountKey,
      expiresAt: Date.now() + SESSION_TTL_MS
    };
    return token;
  }

  async exclusive(operation) {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.catch(() => undefined);
    return result;
  }

  async persist() {
    const temporaryPath = this.filePath + ".tmp-" + randomBytes(8).toString("hex");
    await writeFile(temporaryPath, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }
}
