import { getArenaMap } from "./maps";
import type { CompetitiveMode, MatchConfig } from "./types";

export function createMatchConfig(id: string, mode: CompetitiveMode, mapId: string): MatchConfig {
  const map = getArenaMap(mapId);
  if (!map) throw new Error(`Unknown arena map: ${mapId}`);
  if (!map.supportedModes.includes(mode)) throw new Error(`Map ${mapId} does not support ${mode}.`);

  if (mode === "arena") {
    return {
      id, mode, mapId, minPlayers: 4, maxPlayers: 6,
      countdownMs: 5_000, roundDurationMs: 180_000,
      roundBreakMs: 8_000, roundsToWin: 3, pointsToWin: 25
    };
  }

  return {
    id, mode, mapId, minPlayers: 2, maxPlayers: 6,
    countdownMs: 5_000, roundDurationMs: 360_000,
    roundBreakMs: 1_000, roundsToWin: 1, pointsToWin: 25
  };
}
