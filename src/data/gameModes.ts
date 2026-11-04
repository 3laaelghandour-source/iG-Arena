export type ModeAvailability = "available" | "planned";

export interface GameMode {
  id: "arena" | "deathmatch" | "training";
  name: string;
  category: string;
  description: string;
  availability: ModeAvailability;
  status: string;
  detail: string;
}

export const GAME_MODES: readonly GameMode[] = [
  {
    id: "arena",
    name: "ARENA",
    category: "TEAM PLAY",
    description: "Compete in structured arena rounds with team scoring and match objectives.",
    availability: "planned",
    status: "ONLINE SYSTEM REQUIRED",
    detail: "Team sessions, round flow, matchmaking and server-authoritative scoring are not connected yet."
  },
  {
    id: "deathmatch",
    name: "DEATHMATCH",
    category: "FREE FOR ALL",
    description: "A fast arcade playlist built around individual score and match placement.",
    availability: "planned",
    status: "ONLINE SYSTEM REQUIRED",
    detail: "This playlist will become playable after online sessions and the game server are implemented."
  },
  {
    id: "training",
    name: "TRAINING",
    category: "SOLO PRACTICE",
    description: "Enter the current training facility, learn the controls and test your aim against range targets.",
    availability: "available",
    status: "PLAYABLE NOW",
    detail: "A local single-player session. Progress is temporary and is not uploaded to an account."
  }
] as const;
