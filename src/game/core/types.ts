export type CompetitiveMode = "arena" | "deathmatch";
export type MatchPhase = "waiting" | "countdown" | "live" | "round-break" | "finished";
export type TeamId = "red" | "blue";

export interface MatchPlayerInput {
  id: string;
  displayName: string;
}

export interface MatchPlayer {
  id: string;
  displayName: string;
  team: TeamId | null;
  ready: boolean;
  connected: boolean;
  points: number;
  roundsWon: number;
}

export interface MatchConfig {
  id: string;
  mode: CompetitiveMode;
  mapId: string;
  minPlayers: number;
  maxPlayers: number;
  countdownMs: number;
  roundDurationMs: number;
  roundBreakMs: number;
  roundsToWin: number;
  pointsToWin: number;
}

export interface MatchSnapshot {
  id: string;
  mode: CompetitiveMode;
  mapId: string;
  phase: MatchPhase;
  roundNumber: number;
  phaseEndsAt: number | null;
  players: MatchPlayer[];
  teamPoints: Record<TeamId, number>;
  roundWins: Record<TeamId, number>;
  winnerTeam: TeamId | null;
  winnerPlayerId: string | null;
  resultReason: string | null;
}
