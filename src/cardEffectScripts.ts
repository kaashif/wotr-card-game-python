import { cardDefinitions } from "./data";
import type { CardDefinition } from "./types";

export type CardImplementationStatus = "implemented" | "todo";

export type EffectTiming =
  | "always"
  | "whenPlayed"
  | "whenPlayedOrMoved"
  | "whileInReserve"
  | "whenForsakenFromDraw"
  | "whenEliminated"
  | "useAction"
  | "combat";

export type EffectInstruction =
  | { readonly type: "noop" }
  | { readonly type: "todo"; readonly note: string }
  | { readonly type: "draw"; readonly target: EffectTarget; readonly count: number }
  | { readonly type: "cycleSelf" }
  | { readonly type: "eliminateSelf" }
  | { readonly type: "forsake"; readonly target: EffectTarget; readonly count: number }
  | { readonly type: "cycleFromHand"; readonly target: EffectTarget; readonly count: number }
  | { readonly type: "addPathAttack"; readonly count: number }
  | { readonly type: "addPathDefense"; readonly count: number }
  | { readonly type: "addBattlegroundAttack"; readonly count: number }
  | { readonly type: "addBattlegroundDefense"; readonly count: number }
  | { readonly type: "addCorruption"; readonly count: number }
  | { readonly type: "removeCorruption"; readonly count: number | "hobbitsOnPath" }
  | { readonly type: "search"; readonly target: EffectTarget; readonly query: string; readonly from: readonly SearchZone[] }
  | { readonly type: "activatePath"; readonly selector: PathSelector }
  | { readonly type: "activateBattleground"; readonly selector: BattlegroundSelector; readonly reactivate: boolean }
  | { readonly type: "moveWielder"; readonly destination: "path" | "battleground" }
  | { readonly type: "playFromDrawn"; readonly max: number; readonly filter: string }
  | { readonly type: "cycleRestDrawn" }
  | { readonly type: "replacementCycleInstead" }
  | { readonly type: "modifyCarryover"; readonly amount: number };

export type EffectTarget =
  | "self"
  | "owner"
  | "freePlayers"
  | "shadowPlayers"
  | "eachPlayer"
  | "hobbitPlayer"
  | "mordorPlayer"
  | "elfPlayer"
  | "dunedainPlayer"
  | "monstrousPlayer"
  | "isengardPlayer"
  | "rohanPlayer";

export type SearchZone = "draw" | "cycle" | "hand" | "reserve" | "inPlay";

export type PathSelector =
  | { readonly type: "sameNumberDifferent" }
  | { readonly type: "nextHigher" }
  | { readonly type: "specificNumber"; readonly pathNumber: number };

export type BattlegroundSelector =
  | { readonly type: "any" }
  | { readonly type: "faction"; readonly faction: string }
  | { readonly type: "specific"; readonly id: string };

export interface TimedEffectScript {
  readonly timing: EffectTiming;
  readonly instructions: readonly EffectInstruction[];
}

export interface CardEffectImplementation {
  readonly cardId: string;
  readonly status: CardImplementationStatus;
  readonly scripts: readonly TimedEffectScript[];
  readonly todo?: string;
}

const explicitScripts: Readonly<Record<string, readonly TimedEffectScript[]>> = {
  "aragorn-38": [
    {
      timing: "whenPlayed",
      instructions: [{ type: "search", target: "owner", query: "Strider in play", from: ["inPlay"] }],
    },
    { timing: "whileInReserve", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "whenForsakenFromDraw", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "boromir-39": [
    { timing: "whenPlayed", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "whenPlayedOrMoved", instructions: [{ type: "forsake", target: "owner", count: 1 }] },
  ],
  "faramir-41": [
    { timing: "whenPlayedOrMoved", instructions: [{ type: "activatePath", selector: { type: "sameNumberDifferent" } }] },
  ],
  "strider-44": [
    { timing: "useAction", instructions: [{ type: "activatePath", selector: { type: "nextHigher" } }] },
  ],
  "arwen-53": [
    { timing: "whenPlayed", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "whileInReserve", instructions: [{ type: "addPathDefense", count: 1 }] },
  ],
  "elrond-54": [
    { timing: "whenPlayed", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "always", instructions: [{ type: "modifyCarryover", amount: 1 }] },
  ],
  "galadriel-55": [
    {
      timing: "whileInReserve",
      instructions: [
        { type: "draw", target: "owner", count: 1 },
        { type: "cycleFromHand", target: "owner", count: 1 },
      ],
    },
    { timing: "whenPlayed", instructions: [{ type: "draw", target: "owner", count: 1 }] },
  ],
  "legolas-56": [
    { timing: "whenPlayed", instructions: [{ type: "search", target: "owner", query: "Bow of Galadhrim", from: ["draw"] }] },
  ],
  "lembas-59": [
    {
      timing: "useAction",
      instructions: [
        { type: "eliminateSelf" },
        { type: "removeCorruption", count: "hobbitsOnPath" },
      ],
    },
  ],
  "nenya-ring-of-adamant-61": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "addPathDefense", count: 1 }] },
  ],
  "phial-of-galadriel-62": [
    { timing: "always", instructions: [{ type: "addPathDefense", count: 2 }] },
  ],
  "vilya-ring-of-air-63": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "draw", target: "freePlayers", count: 1 }] },
  ],
  "frodo-baggins-69": [
    { timing: "whenEliminated", instructions: [{ type: "replacementCycleInstead" }] },
    { timing: "whenForsakenFromDraw", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "sam-gamgee-72": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "addPathDefense", count: 1 }] },
  ],
  "bilbo-baggins-73": [
    { timing: "whenEliminated", instructions: [{ type: "replacementCycleInstead" }] },
    { timing: "whenForsakenFromDraw", instructions: [{ type: "replacementCycleInstead" }] },
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "draw", target: "owner", count: 2 }] },
  ],
  "fatty-bolger-74": [
    { timing: "whenForsakenFromDraw", instructions: [{ type: "replacementCycleInstead" }] },
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "draw", target: "owner", count: 3 }] },
  ],
  "there-is-another-way-78": [
    {
      timing: "whenPlayed",
      instructions: [
        { type: "activatePath", selector: { type: "sameNumberDifferent" } },
        { type: "addPathDefense", count: 1 },
      ],
    },
  ],
  "gandalf-the-grey-88": [
    { timing: "useAction", instructions: [{ type: "activatePath", selector: { type: "nextHigher" } }] },
  ],
  "gandalf-the-white-89": [
    { timing: "whenPlayed", instructions: [{ type: "search", target: "owner", query: "Gandalf the Grey in play", from: ["inPlay"] }] },
    { timing: "whileInReserve", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "whenForsakenFromDraw", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "smeagol-92": [
    { timing: "useAction", instructions: [{ type: "activatePath", selector: { type: "nextHigher" } }, { type: "addCorruption", count: 1 }] },
    { timing: "whenEliminated", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "saruman-107": [
    { timing: "whileInReserve", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "whenForsakenFromDraw", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "ugluk-108": [
    { timing: "useAction", instructions: [{ type: "activatePath", selector: { type: "sameNumberDifferent" } }] },
  ],
  "barrow-wights-115": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "forsake", target: "freePlayers", count: 1 }] },
  ],
  "flocks-of-crebain-116": [
    { timing: "useAction", instructions: [{ type: "activatePath", selector: { type: "sameNumberDifferent" } }] },
  ],
  "hill-troll-117": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "forsake", target: "freePlayers", count: 1 }] },
  ],
  "balrog-118": [
    { timing: "whenPlayedOrMoved", instructions: [{ type: "forsake", target: "freePlayers", count: 1 }] },
  ],
  "caradhras-119": [
    { timing: "whenPlayed", instructions: [{ type: "activatePath", selector: { type: "sameNumberDifferent" } }] },
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "forsake", target: "freePlayers", count: 1 }] },
  ],
  "cave-troll-120": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "forsake", target: "freePlayers", count: 1 }] },
  ],
  "candles-of-corpses-121": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "forsake", target: "freePlayers", count: 1 }] },
  ],
  "gollum-122": [
    { timing: "useAction", instructions: [{ type: "activatePath", selector: { type: "sameNumberDifferent" } }] },
    { timing: "whenEliminated", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "shelob-123": [
    { timing: "whenPlayedOrMoved", instructions: [{ type: "forsake", target: "freePlayers", count: 1 }] },
  ],
  "the-witch-king-nazgul-144": [
    { timing: "whileInReserve", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "whenForsakenFromDraw", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "the-reaver-nazgul-145": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "forsake", target: "freePlayers", count: 1 }] },
  ],
  "the-beguiler-nazgul-146": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "cycleFromHand", target: "freePlayers", count: 1 }] },
  ],
  "the-hunter-nazgul-147": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "addPathAttack", count: 1 }] },
  ],
  "the-black-easterling-nazgul-149": [
    { timing: "whenPlayed", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "always", instructions: [{ type: "addBattlegroundDefense", count: 1 }] },
  ],
  "the-commander-nazgul-150": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "draw", target: "shadowPlayers", count: 1 }] },
  ],
  "the-destroyer-nazgul-151": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "addBattlegroundAttack", count: 1 }] },
  ],
  "the-warrior-nazgul-152": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "addBattlegroundDefense", count: 1 }] },
  ],
  "grishnakh-153": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "addCorruption", count: 1 }] },
  ],
  "the-lidless-eye-156": [
    { timing: "whenPlayed", instructions: [{ type: "draw", target: "shadowPlayers", count: 1 }] },
    { timing: "always", instructions: [{ type: "modifyCarryover", amount: 1 }] },
  ],
  "gothmog-157": [
    { timing: "whileInReserve", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "whenPlayed", instructions: [{ type: "search", target: "owner", query: "Witch-King in play", from: ["inPlay"] }] },
  ],
  "black-breath-159": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "addCorruption", count: 1 }] },
  ],
  "morgul-blade-162": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "addCorruption", count: 1 }] },
  ],
  "the-ringwraiths-are-abroad-164": [
    {
      timing: "whenPlayed",
      instructions: [
        { type: "draw", target: "owner", count: 7 },
        { type: "playFromDrawn", max: 2, filter: "Nazgul character" },
        { type: "cycleRestDrawn" },
      ],
    },
  ],
  "the-day-without-dawn-165": [
    {
      timing: "whenPlayed",
      instructions: [
        { type: "draw", target: "owner", count: 7 },
        { type: "playFromDrawn", max: 2, filter: "army" },
        { type: "cycleRestDrawn" },
      ],
    },
  ],
};

export const cardEffectImplementations: readonly CardEffectImplementation[] =
  cardDefinitions.map((card) => implementationFor(card));

export function getCardEffectImplementation(cardId: string): CardEffectImplementation {
  const implementation = cardEffectImplementations.find((entry) => entry.cardId === cardId);
  if (implementation === undefined) {
    throw new Error(`Missing card effect implementation for ${cardId}`);
  }
  return implementation;
}

function implementationFor(card: CardDefinition): CardEffectImplementation {
  const scripts = explicitScripts[card.id] ?? inferSimpleScripts(card);
  if (scripts.length > 0) {
    return { cardId: card.id, status: "implemented", scripts };
  }
  if (card.text.trim() === "") {
    return {
      cardId: card.id,
      status: "implemented",
      scripts: [{ timing: "always", instructions: [{ type: "noop" }] }],
    };
  }
  return {
    cardId: card.id,
    status: "todo",
    scripts: [{ timing: "always", instructions: [{ type: "todo", note: card.text }] }],
    todo: card.text,
  };
}

function inferSimpleScripts(card: CardDefinition): readonly TimedEffectScript[] {
  const text = card.text.toLowerCase();
  const scripts: TimedEffectScript[] = [];
  const drawMatch = text.match(/^when played draw (\d+) card/);
  if (drawMatch?.[1] !== undefined) {
    scripts.push({
      timing: "whenPlayed",
      instructions: [{ type: "draw", target: "owner", count: Number(drawMatch[1]) }],
    });
  }
  if (text.includes("while in play increase your carryover limit by 1")) {
    scripts.push({
      timing: "always",
      instructions: [{ type: "modifyCarryover", amount: 1 }],
    });
  }
  if (text.includes("if forsaken from top of the draw deck, cycle instead")) {
    scripts.push({
      timing: "whenForsakenFromDraw",
      instructions: [{ type: "replacementCycleInstead" }],
    });
  }
  return scripts;
}
