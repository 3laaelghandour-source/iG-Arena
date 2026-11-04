export interface ArenaEquipment {
  id: string;
  name: string;
  className: string;
  description: string;
  accent: string;
  glow: string;
  capacity: number;
  reserve: number;
  pulseCooldownMs: number;
  rechargeMs: number;
}

export const ARENA_EQUIPMENT: readonly ArenaEquipment[] = [
  {
    id: "pulse-arc",
    name: "PULSE ARC",
    className: "ARC",
    description: "A clean, precise energy projector with a cool cyan pulse signature.",
    accent: "#66e7f2",
    glow: "#1b8296",
    capacity: 24,
    reserve: 96,
    pulseCooldownMs: 420,
    rechargeMs: 1100
  },
  {
    id: "ember-coil",
    name: "EMBER COIL",
    className: "COIL",
    description: "A warm amber emitter with a slower, heavier-looking energy flare.",
    accent: "#ffb36b",
    glow: "#a85227",
    capacity: 18,
    reserve: 72,
    pulseCooldownMs: 560,
    rechargeMs: 1400
  },
  {
    id: "prism-loop",
    name: "PRISM LOOP",
    className: "LOOP",
    description: "A compact ring projector that releases quick, bright training pulses.",
    accent: "#a7f2bd",
    glow: "#328b67",
    capacity: 30,
    reserve: 90,
    pulseCooldownMs: 340,
    rechargeMs: 1250
  }
] as const;

export function getArenaEquipment(id: string): ArenaEquipment {
  return ARENA_EQUIPMENT.find((item) => item.id === id) ?? ARENA_EQUIPMENT[0];
}
