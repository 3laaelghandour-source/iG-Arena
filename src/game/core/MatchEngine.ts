import { getArenaMap } from "./maps";
import type { MatchConfig, MatchPhase, MatchPlayer, MatchPlayerInput, MatchSnapshot, TeamId } from "./types";

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer.`);
}

export class MatchEngine {
  private players = new Map<string, MatchPlayer>();
  private phase: MatchPhase = "waiting";
  private roundNumber = 1;
  private phaseEndsAt: number | null = null;
  private teamPoints: Record<TeamId, number> = { red: 0, blue: 0 };
  private roundWins: Record<TeamId, number> = { red: 0, blue: 0 };
  private winnerTeam: TeamId | null = null;
  private winnerPlayerId: string | null = null;
  private resultReason: string | null = null;

  constructor(readonly config: MatchConfig) {
    const map = getArenaMap(config.mapId);
    if (!map) throw new Error(`Unknown arena map: ${config.mapId}`);
    if (!map.supportedModes.includes(config.mode)) throw new Error(`Map ${config.mapId} does not support ${config.mode}.`);
    for (const [field, value] of Object.entries({
      minPlayers: config.minPlayers, maxPlayers: config.maxPlayers,
      countdownMs: config.countdownMs, roundDurationMs: config.roundDurationMs,
      roundBreakMs: config.roundBreakMs, pointsToWin: config.pointsToWin
    })) assertPositiveInteger(value, field);
    if (config.minPlayers > config.maxPlayers) throw new Error("minPlayers cannot exceed maxPlayers.");
    if (config.mode === "arena") {
      assertPositiveInteger(config.roundsToWin, "roundsToWin");
      if (config.minPlayers < 2) throw new Error("Arena requires both teams to have players.");
    }
  }

  addPlayer(input: MatchPlayerInput): MatchPlayer {
    if (this.phase !== "waiting") throw new Error("Players can only join while the match is waiting.");
    if (this.players.has(input.id)) throw new Error("Player is already in this match.");
    if (this.players.size >= this.config.maxPlayers) throw new Error("This match is full.");
    const displayName = input.displayName.trim();
    if (!input.id.trim() || !displayName || displayName.length > 24) {
      throw new Error("A valid player ID and display name are required.");
    }
    const player: MatchPlayer = {
      id: input.id, displayName,
      team: this.config.mode === "arena" ? this.getSmallerTeam() : null,
      ready: false, connected: true, points: 0, roundsWon: 0
    };
    this.players.set(player.id, player);
    return { ...player };
  }

  setReady(playerId: string, ready: boolean, nowMs: number): void {
    if (this.phase !== "waiting") throw new Error("Ready state is locked after the match leaves the waiting phase.");
    this.requirePlayer(playerId).ready = ready;
    if (this.players.size >= this.config.minPlayers && this.readyPlayers().length >= this.config.minPlayers) {
      this.phase = "countdown";
      this.phaseEndsAt = nowMs + this.config.countdownMs;
    }
  }

  setConnected(playerId: string, connected: boolean): void {
    const player = this.requirePlayer(playerId);
    player.connected = connected;
    if (!connected && this.phase === "waiting") player.ready = false;
  }

  awardPlayerPoints(playerId: string, points: number, nowMs: number): void {
    if (this.phase !== "live" || this.config.mode !== "deathmatch") {
      throw new Error("Individual points are only accepted during a live Deathmatch.");
    }
    assertPositiveInteger(points, "points");
    const player = this.requirePlayer(playerId);
    if (!player.connected) throw new Error("Disconnected players cannot score.");
    player.points += points;
    if (player.points >= this.config.pointsToWin) {
      this.finish(null, player.id, "score-limit", nowMs);
    }
  }

  awardTeamPoints(team: TeamId, points: number, nowMs: number): void {
    if (this.config.mode !== "arena") throw new Error("Team points are only available in Arena mode.");
    if (this.phase !== "live") throw new Error("Points can only be awarded during a live round.");
    assertPositiveInteger(points, "points");
    this.teamPoints[team] += points;
    if (this.teamPoints[team] >= this.config.pointsToWin) this.completeRound(team, "round-score-limit", nowMs);
  }

  tick(nowMs: number): void {
    if (this.phaseEndsAt === null || nowMs < this.phaseEndsAt) return;

    if (this.phase === "countdown") {
      if (this.readyPlayers().length < this.config.minPlayers) {
        this.phase = "waiting";
        this.phaseEndsAt = null;
        return;
      }
      this.phase = "live";
      this.phaseEndsAt = nowMs + this.config.roundDurationMs;
      return;
    }

    if (this.phase === "live") {
      if (this.config.mode === "deathmatch") {
        const active = [...this.players.values()].filter((player) => player.connected);
        if (active.length <= 1) {
          this.finish(null, active[0]?.id ?? null, "last-connected-player", nowMs);
          return;
        }
        const ranked = active.sort((a, b) => b.points - a.points);
        const first = ranked[0];
        const tied = ranked[1] !== undefined && first.points === ranked[1].points;
        this.finish(null, tied ? null : first.id, tied ? "time-limit-tie" : "time-limit", nowMs);
      } else {
        const redConnected = [...this.players.values()].some((player) => player.team === "red" && player.connected);
        const blueConnected = [...this.players.values()].some((player) => player.team === "blue" && player.connected);
        if (!redConnected || !blueConnected) {
          this.finish(redConnected ? "red" : blueConnected ? "blue" : null, null, "team-forfeit", nowMs);
          return;
        }
        const winner = this.teamPoints.red === this.teamPoints.blue
          ? null
          : this.teamPoints.red > this.teamPoints.blue ? "red" : "blue";
        this.completeRound(winner, winner ? "round-time-limit" : "round-draw", nowMs);
      }
      return;
    }

    if (this.phase === "round-break") {
      this.roundNumber += 1;
      this.teamPoints = { red: 0, blue: 0 };
      this.phase = "countdown";
      this.phaseEndsAt = nowMs + this.config.countdownMs;
    }
  }

  completeRound(winner: TeamId | null, reason: string, nowMs: number): void {
    if (this.phase !== "live" || this.config.mode !== "arena") {
      throw new Error("Only a live Arena round can be completed.");
    }
    if (winner) {
      this.roundWins[winner] += 1;
      for (const player of this.players.values()) {
        if (player.team === winner) player.roundsWon += 1;
      }
    }
    if (winner && this.roundWins[winner] >= this.config.roundsToWin) {
      this.finish(winner, null, reason, nowMs);
      return;
    }
    this.phase = "round-break";
    this.phaseEndsAt = nowMs + this.config.roundBreakMs;
  }

  getSnapshot(): MatchSnapshot {
    return {
      id: this.config.id, mode: this.config.mode, mapId: this.config.mapId,
      phase: this.phase, roundNumber: this.roundNumber, phaseEndsAt: this.phaseEndsAt,
      players: [...this.players.values()].map((player) => ({ ...player })),
      teamPoints: { ...this.teamPoints }, roundWins: { ...this.roundWins },
      winnerTeam: this.winnerTeam, winnerPlayerId: this.winnerPlayerId,
      resultReason: this.resultReason
    };
  }

  private readyPlayers(): MatchPlayer[] {
    return [...this.players.values()].filter((player) => player.connected && player.ready);
  }

  private finish(winnerTeam: TeamId | null, winnerPlayerId: string | null, reason: string, nowMs: number): void {
    this.phase = "finished";
    this.phaseEndsAt = nowMs;
    this.winnerTeam = winnerTeam;
    this.winnerPlayerId = winnerPlayerId;
    this.resultReason = reason;
  }

  private getSmallerTeam(): TeamId {
    const counts: Record<TeamId, number> = { red: 0, blue: 0 };
    for (const player of this.players.values()) if (player.team) counts[player.team] += 1;
    return counts.red <= counts.blue ? "red" : "blue";
  }

  private requirePlayer(playerId: string): MatchPlayer {
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player is not part of this match.");
    return player;
  }
}
