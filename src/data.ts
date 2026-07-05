import type { PlayerDefinition, PlayerId } from "./types";
import {
  sourceBattlegrounds,
  sourceCards,
  sourcePaths,
} from "./referenceData";

export const players = {
  frodo: {
    id: "frodo",
    name: "Frodo",
    side: "free",
    factions: ["hobbit", "rohan", "wizard", "dwarf"],
    drawCount: 3,
  },
  aragorn: {
    id: "aragorn",
    name: "Aragorn",
    side: "free",
    factions: ["dunedain", "elf"],
    drawCount: 3,
  },
  witchKing: {
    id: "witchKing",
    name: "Witch-king",
    side: "shadow",
    factions: ["mordor"],
    drawCount: 4,
  },
  saruman: {
    id: "saruman",
    name: "Saruman",
    side: "shadow",
    factions: ["isengard", "monstrous", "southron"],
    drawCount: 4,
  },
} as const satisfies Record<PlayerId, PlayerDefinition>;

export const turnOrder: readonly PlayerId[] = [
  "frodo",
  "witchKing",
  "aragorn",
  "saruman",
];

export const cardDefinitions = sourceCards;
export const pathDefinitions = sourcePaths;
export const battlegroundDefinitions = sourceBattlegrounds;
