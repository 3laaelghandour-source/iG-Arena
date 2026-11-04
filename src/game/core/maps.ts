import type { CompetitiveMode } from "./types";

export interface SpawnPoint { x: number; z: number; }
export interface MapStructure {
  x: number; z: number; width: number; depth: number; height: number;
  material: "concrete" | "metal" | "accent";
}
export interface ArenaMapDefinition {
  id: string;
  name: string;
  environment: string;
  description: string;
  bounds: { width: number; depth: number };
  supportedModes: readonly CompetitiveMode[];
  structures: readonly MapStructure[];
  spawns: {
    red: readonly SpawnPoint[];
    blue: readonly SpawnPoint[];
    freeForAll: readonly SpawnPoint[];
  };
}
export const ARENA_MAPS: readonly ArenaMapDefinition[] = [
  {
    id: "foundry", name: "FOUNDRY", environment: "INDUSTRIAL",
    description: "A compact industrial arena with open lanes and central cover structures.",
    bounds: { width: 64, depth: 64 }, supportedModes: ["arena", "deathmatch"],
    structures: [
      { x: 0, z: 0, width: 8, depth: 8, height: 3.4, material: "metal" },
      { x: -13, z: -11, width: 7, depth: 3, height: 2.2, material: "concrete" },
      { x: 13, z: 11, width: 7, depth: 3, height: 2.2, material: "concrete" },
      { x: -13, z: 11, width: 3, depth: 7, height: 2.2, material: "concrete" },
      { x: 13, z: -11, width: 3, depth: 7, height: 2.2, material: "concrete" },
      { x: 0, z: -23, width: 15, depth: 1, height: 4, material: "accent" },
      { x: 0, z: 23, width: 15, depth: 1, height: 4, material: "accent" }
    ],
    spawns: {
      red: [{ x: -24, z: -20 }, { x: -24, z: 0 }, { x: -24, z: 20 }],
      blue: [{ x: 24, z: -20 }, { x: 24, z: 0 }, { x: 24, z: 20 }],
      freeForAll: [
        { x: -24, z: -22 }, { x: 0, z: -24 }, { x: 24, z: -22 },
        { x: -24, z: 22 }, { x: 0, z: 24 }, { x: 24, z: 22 }
      ]
    }
  },
  {
    id: "district", name: "DISTRICT", environment: "URBAN",
    description: "A wider urban block with staggered structures and several routes through the centre.",
    bounds: { width: 88, depth: 72 }, supportedModes: ["arena", "deathmatch"],
    structures: [
      { x: -12, z: 0, width: 4, depth: 15, height: 3.8, material: "concrete" },
      { x: 12, z: 0, width: 4, depth: 15, height: 3.8, material: "concrete" },
      { x: 0, z: -14, width: 13, depth: 3, height: 2.4, material: "metal" },
      { x: 0, z: 14, width: 13, depth: 3, height: 2.4, material: "metal" },
      { x: -27, z: -20, width: 9, depth: 5, height: 3.2, material: "accent" },
      { x: 27, z: 20, width: 9, depth: 5, height: 3.2, material: "accent" },
      { x: -27, z: 20, width: 5, depth: 9, height: 3.2, material: "concrete" },
      { x: 27, z: -20, width: 5, depth: 9, height: 3.2, material: "concrete" }
    ],
    spawns: {
      red: [{ x: -34, z: -22 }, { x: -34, z: 0 }, { x: -34, z: 22 }],
      blue: [{ x: 34, z: -22 }, { x: 34, z: 0 }, { x: 34, z: 22 }],
      freeForAll: [
        { x: -34, z: -26 }, { x: 0, z: -28 }, { x: 34, z: -26 },
        { x: -34, z: 26 }, { x: 0, z: 28 }, { x: 34, z: 26 }
      ]
    }
  },
  {
    id: "overpass", name: "OVERPASS", environment: "MODERN",
    description: "A modern arena with separated zones and open central space.",
    bounds: { width: 80, depth: 80 }, supportedModes: ["arena", "deathmatch"],
    structures: [
      { x: 0, z: -15, width: 23, depth: 4, height: 3.2, material: "metal" },
      { x: 0, z: 15, width: 23, depth: 4, height: 3.2, material: "metal" },
      { x: -19, z: 0, width: 4, depth: 17, height: 2.5, material: "concrete" },
      { x: 19, z: 0, width: 4, depth: 17, height: 2.5, material: "concrete" },
      { x: 0, z: 0, width: 7, depth: 7, height: 4, material: "accent" },
      { x: -14, z: 0, width: 1.4, depth: 1.4, height: 5.2, material: "metal" },
      { x: 14, z: 0, width: 1.4, depth: 1.4, height: 5.2, material: "metal" },
      { x: -29, z: -29, width: 8, depth: 4, height: 2.3, material: "concrete" },
      { x: 29, z: 29, width: 8, depth: 4, height: 2.3, material: "concrete" }
    ],
    spawns: {
      red: [{ x: -30, z: -24 }, { x: -30, z: 0 }, { x: -30, z: 24 }],
      blue: [{ x: 30, z: -24 }, { x: 30, z: 0 }, { x: 30, z: 24 }],
      freeForAll: [
        { x: -30, z: -30 }, { x: 0, z: -30 }, { x: 30, z: -30 },
        { x: -30, z: 30 }, { x: 0, z: 30 }, { x: 30, z: 30 }
      ]
    }
  }
] as const;
export function getArenaMap(mapId: string): ArenaMapDefinition | undefined {
  return ARENA_MAPS.find((map) => map.id === mapId);
}
