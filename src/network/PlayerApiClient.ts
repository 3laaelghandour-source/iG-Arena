export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  xp: number;
  lastMatchAt: string | null;
}

export interface PlayerProfile {
  username: string;
  createdAt: string;
  stats: PlayerStats;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  stats: Pick<PlayerStats, "matchesPlayed" | "wins" | "points" | "xp">;
}

type AuthResponse = { token: string; profile: PlayerProfile };

export class PlayerApiClient {
  private readonly tokenKey = "ig-arena-session";
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    const parsed = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Player API URL must use HTTP or HTTPS.");
    }
    this.baseUrl = parsed.toString().replace(/\/$/, "");
  }

  hasSession(): boolean {
    return Boolean(sessionStorage.getItem(this.tokenKey));
  }

  async register(username: string, password: string): Promise<PlayerProfile> {
    const result = await this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    this.saveToken(result.token);
    return result.profile;
  }

  async login(username: string, password: string): Promise<PlayerProfile> {
    const result = await this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    this.saveToken(result.token);
    return result.profile;
  }

  async getMe(): Promise<PlayerProfile> {
    const result = await this.request<{ profile: PlayerProfile }>("/api/me");
    return result.profile;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const result = await this.request<{ players: LeaderboardEntry[] }>("/api/leaderboard?limit=20");
    return result.players;
  }

  async logout(): Promise<void> {
    try {
      await this.request<null>("/api/auth/logout", { method: "POST" });
    } finally {
      sessionStorage.removeItem(this.tokenKey);
    }
  }

  private saveToken(token: string): void {
    if (typeof token !== "string" || token.length < 32) {
      throw new Error("invalid-server-response");
    }
    sessionStorage.setItem(this.tokenKey, token);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");

    const token = sessionStorage.getItem(this.tokenKey);
    if (token) headers.set("Authorization", "Bearer " + token);

    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, { ...init, headers, cache: "no-store" });
    } catch {
      throw new Error("network-error");
    }

    if (response.status === 401) sessionStorage.removeItem(this.tokenKey);
    if (response.status === 204) return null as T;

    let payload: Record<string, unknown> = {};
    try {
      payload = await response.json() as Record<string, unknown>;
    } catch {
      if (!response.ok) throw new Error("request-failed");
    }

    if (!response.ok) {
      const code = typeof payload.error === "string" ? payload.error : "request-failed";
      throw new Error(code);
    }

    return payload as T;
  }
}
