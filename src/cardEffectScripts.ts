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
  | { readonly type: "modifyCarryover"; readonly amount: number }
  | { readonly type: "conditionalCombatModifier"; readonly note: string }
  | { readonly type: "playRestriction"; readonly note: string }
  | { readonly type: "roundRuleModifier"; readonly note: string }
  | { readonly type: "replacementEffect"; readonly note: string };

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
  "dead-man-of-dunharow-33": [
    {
      timing: "combat",
      instructions: [{ type: "conditionalCombatModifier", note: "+2 attack and +2 defense when supporting Strider or Aragorn" }],
    },
  ],
  "knights-of-dol-amroth-34": [
    { timing: "combat", instructions: [{ type: "conditionalCombatModifier", note: "+1 defense on Dol Amroth" }] },
  ],
  "guards-of-the-citadel-35": [
    { timing: "combat", instructions: [{ type: "conditionalCombatModifier", note: "+1 defense on Minas Tirith" }] },
  ],
  "the-greatt-gate-37": [
    { timing: "combat", instructions: [{ type: "conditionalCombatModifier", note: "+3 defense on Minas Tirith" }] },
    { timing: "always", instructions: [{ type: "playRestriction", note: "Can never be played or moved to a Shadow battleground" }] },
  ],
  "denethor-40": [
    {
      timing: "useAction",
      instructions: [
        { type: "forsake", target: "owner", count: 1 },
        { type: "search", target: "owner", query: "Boromir or Faramir from draw deck to hand", from: ["draw"] },
      ],
    },
  ],
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
  "halbarad-42": [
    {
      timing: "useAction",
      instructions: [
        { type: "cycleSelf" },
        { type: "search", target: "owner", query: "Strider or Aragorn from draw deck to hand", from: ["draw"] },
      ],
    },
  ],
  "prince-imrahil-43": [
    {
      timing: "whenPlayed",
      instructions: [
        { type: "cycleFromHand", target: "owner", count: 1 },
        { type: "search", target: "owner", query: "Knights of Dol Amroth from draw deck to hand", from: ["draw"] },
      ],
    },
  ],
  "faramir-41": [
    { timing: "whenPlayedOrMoved", instructions: [{ type: "activatePath", selector: { type: "sameNumberDifferent" } }] },
  ],
  "strider-44": [
    { timing: "useAction", instructions: [{ type: "activatePath", selector: { type: "nextHigher" } }] },
  ],
  "ioreth-45": [
    {
      timing: "whenEliminated",
      instructions: [{ type: "replacementEffect", note: "After battleground combat, cycle Ioreth with one other non-Wizard character instead of eliminating them; wielded items are eliminated" }],
    },
  ],
  "anduril-46": [
    {
      timing: "useAction",
      instructions: [
        { type: "activateBattleground", selector: { type: "faction", faction: "dunedain" }, reactivate: true },
        { type: "moveWielder", destination: "battleground" },
      ],
    },
  ],
  "paths-of-the-dead-48": [
    {
      timing: "whenPlayed",
      instructions: [
        { type: "forsake", target: "owner", count: 2 },
        { type: "draw", target: "owner", count: 4 },
        { type: "conditionalCombatModifier", note: "Draw one additional card if Strider or Aragorn is in play" },
      ],
    },
  ],
  "the-red-arrow-49": [
    { timing: "whenPlayed", instructions: [{ type: "roundRuleModifier", note: "This round Rohan cards may be played on Dunedain battlegrounds" }] },
  ],
  "the-three-hunters-50": [
    {
      timing: "whenPlayed",
      instructions: [{ type: "roundRuleModifier", note: "This round Strider/Aragorn, Gimli, and Legolas may be moved or played on any battleground and supported by any Free Peoples army" }],
    },
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
  "bow-of-galadhrim-57": [
    { timing: "always", instructions: [{ type: "playRestriction", note: "Wielder cannot wield another weapon" }] },
  ],
  "elven-cloak-58": [
    {
      timing: "whenEliminated",
      instructions: [{ type: "replacementEffect", note: "If wielder is eliminated in path combat, cycle the wielder instead along with any wielded items" }],
    },
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
  "mirror-of-galadriel-60": [
    { timing: "always", instructions: [{ type: "roundRuleModifier", note: "Controller may always examine the top card of their draw deck while this is in play" }] },
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
  "gimli-67": [
    { timing: "whenPlayed", instructions: [{ type: "search", target: "owner", query: "Dwarven Axe from cycle pile to hand", from: ["cycle"] }] },
  ],
  "frodo-baggins-69": [
    { timing: "whenEliminated", instructions: [{ type: "replacementCycleInstead" }] },
    { timing: "whenForsakenFromDraw", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "merry-brandybuck-70": [
    { timing: "always", instructions: [{ type: "playRestriction", note: "May be played or moved to a Rohan battleground supported by a Rohan army" }] },
    {
      timing: "whenEliminated",
      instructions: [{ type: "replacementEffect", note: "If eliminated in path combat, cycle Merry instead along with any wielded items" }],
    },
  ],
  "pippin-took-71": [
    { timing: "always", instructions: [{ type: "playRestriction", note: "May be played or moved to a Dunedain battleground supported by a Dunedain army" }] },
    {
      timing: "whenEliminated",
      instructions: [{ type: "replacementEffect", note: "If eliminated in path combat, cycle Pippin instead along with any wielded items" }],
    },
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
  "herbs-stewed-rabbit-75": [
    {
      timing: "useAction",
      instructions: [
        { type: "eliminateSelf" },
        { type: "search", target: "owner", query: "one Hobbit character from cycle pile to hand", from: ["cycle"] },
        { type: "draw", target: "owner", count: 1 },
      ],
    },
  ],
  "sting-76": [
    {
      timing: "combat",
      instructions: [{ type: "conditionalCombatModifier", note: "If wielder is on a path with a Monstrous character, add 1 defense token to the active path" }],
    },
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
  "eowyn-83": [
    {
      timing: "whenPlayed",
      instructions: [
        { type: "conditionalCombatModifier", note: "If played to a battleground, may eliminate one Nazgul character" },
        { type: "search", target: "owner", query: "If played to reserve, take Merry or Pippin from cycle pile to hand", from: ["cycle"] },
      ],
    },
  ],
  "ghan-buri-ghan-84": [
    { timing: "whileInReserve", instructions: [{ type: "playRestriction", note: "Rohan cards may be played or moved to Minas Tirith" }] },
  ],
  "theoden-85": [
    { timing: "combat", instructions: [{ type: "conditionalCombatModifier", note: "+1 if Gandalf is in play" }] },
    {
      timing: "whenPlayed",
      instructions: [
        { type: "draw", target: "owner", count: 5 },
        { type: "playFromDrawn", max: 1, filter: "Rohan card" },
        { type: "cycleRestDrawn" },
      ],
    },
  ],
  "shadowfax-86": [
    {
      timing: "useAction",
      instructions: [
        { type: "activateBattleground", selector: { type: "any" }, reactivate: true },
        { type: "moveWielder", destination: "battleground" },
      ],
    },
  ],
  "death-ride-ride-to-ruin-87": [
    {
      timing: "whenPlayed",
      instructions: [{ type: "replacementEffect", note: "Eliminate any number of Rohan cards in reserve; Mordor must eliminate the same number of Mordor cards from active battlegrounds" }],
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
  "treebeard-ent-90": [
    { timing: "combat", instructions: [{ type: "conditionalCombatModifier", note: "+1 on Orthanc" }] },
    {
      timing: "whenPlayedOrMoved",
      instructions: [{ type: "replacementEffect", note: "If played or moved to a battleground, Isengard player must eliminate one Isengard army" }],
    },
  ],
  "quickbeam-ent-91": [
    { timing: "combat", instructions: [{ type: "conditionalCombatModifier", note: "+1 for every two Isengard characters/armies on the same battleground" }] },
  ],
  "smeagol-92": [
    { timing: "useAction", instructions: [{ type: "activatePath", selector: { type: "nextHigher" } }, { type: "addCorruption", count: 1 }] },
    { timing: "whenEliminated", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "gwaihir-the-windlord-93": [
    {
      timing: "useAction",
      instructions: [
        { type: "cycleSelf" },
        { type: "search", target: "owner", query: "Gandalf from cycle pile to hand", from: ["cycle"] },
      ],
    },
  ],
  "narya-ring-of-fire-96": [
    {
      timing: "useAction",
      instructions: [
        { type: "cycleSelf" },
        { type: "cycleFromHand", target: "shadowPlayers", count: 1 },
      ],
    },
  ],
  "ent-draught-97": [
    {
      timing: "useAction",
      instructions: [
        { type: "eliminateSelf" },
        { type: "search", target: "owner", query: "two Hobbit characters from cycle pile to hand", from: ["cycle"] },
      ],
    },
  ],
  "grima-wormtongue-106": [
    {
      timing: "useAction",
      instructions: [
        { type: "eliminateSelf" },
        { type: "search", target: "owner", query: "Saruman from draw deck to hand, or eliminate a Rohan character", from: ["draw", "inPlay"] },
      ],
    },
  ],
  "saruman-107": [
    { timing: "whileInReserve", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "whenForsakenFromDraw", instructions: [{ type: "replacementCycleInstead" }] },
  ],
  "ugluk-108": [
    { timing: "useAction", instructions: [{ type: "activatePath", selector: { type: "sameNumberDifferent" } }] },
  ],
  "palantir-109": [
    { timing: "useAction", instructions: [{ type: "roundRuleModifier", note: "Once per round examine top 3 draw cards; eliminate one, cycle one, take one into hand" }] },
  ],
  "woven-of-all-colours-111": [
    {
      timing: "whenEliminated",
      instructions: [{ type: "replacementEffect", note: "If wielder Saruman is eliminated in combat, cycle instead along with any wielded items" }],
    },
  ],
  "threats-and-promises-112": [
    {
      timing: "whenPlayed",
      instructions: [
        { type: "activateBattleground", selector: { type: "faction", faction: "isengard" }, reactivate: true },
        { type: "moveWielder", destination: "battleground" },
      ],
    },
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
  "whip-of-many-thongs-124": [
    { timing: "whenPlayed", instructions: [{ type: "draw", target: "owner", count: 1 }] },
  ],
  "coastal-raiders-126": [
    { timing: "combat", instructions: [{ type: "conditionalCombatModifier", note: "+1 on Dol Amroth battleground" }] },
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "activateBattleground", selector: { type: "specific", id: "dol-amroth" }, reactivate: false }] },
  ],
  "haradrim-cavalry-127": [
    { timing: "combat", instructions: [{ type: "conditionalCombatModifier", note: "+1 on Minas Tirith battleground" }] },
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "activateBattleground", selector: { type: "specific", id: "minas-tirith" }, reactivate: false }] },
  ],
  "the-black-fleet-128": [
    { timing: "combat", instructions: [{ type: "conditionalCombatModifier", note: "+1 on Pelargir battleground" }] },
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "activateBattleground", selector: { type: "specific", id: "pelargir" }, reactivate: false }] },
  ],
  "corsairs-of-umbar-129": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "activateBattleground", selector: { type: "specific", id: "umbar" }, reactivate: false }] },
  ],
  "haradrim-regulars-130": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "activateBattleground", selector: { type: "specific", id: "harad" }, reactivate: false }] },
  ],
  "the-black-serpent-131": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "activateBattleground", selector: { type: "faction", faction: "southron" }, reactivate: true }] },
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
  "the-messenger-nazgul-148": [
    {
      timing: "useAction",
      instructions: [
        { type: "cycleSelf" },
        { type: "search", target: "owner", query: "Nazgul character from cycle pile to hand", from: ["cycle"] },
      ],
    },
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
  "mouth-of-sauron-154": [
    { timing: "always", instructions: [{ type: "playRestriction", note: "Cannot be played or moved to a path if a Shadow battleground is active" }] },
    { timing: "whileInReserve", instructions: [{ type: "draw", target: "owner", count: 1 }] },
  ],
  "gorbag-shagrat-155": [
    {
      timing: "whenPlayedOrMoved",
      instructions: [{ type: "conditionalCombatModifier", note: "When on a path, may cycle one card from hand to add one attack token, or two if Cirith Ungol is active" }],
    },
  ],
  "the-lidless-eye-156": [
    { timing: "whenPlayed", instructions: [{ type: "draw", target: "shadowPlayers", count: 1 }] },
    { timing: "always", instructions: [{ type: "modifyCarryover", amount: 1 }] },
  ],
  "gothmog-157": [
    { timing: "whileInReserve", instructions: [{ type: "draw", target: "owner", count: 1 }] },
    { timing: "whenPlayed", instructions: [{ type: "search", target: "owner", query: "Witch-King in play", from: ["inPlay"] }] },
  ],
  "nazguls-mantle-158": [
    {
      timing: "whenEliminated",
      instructions: [{ type: "replacementEffect", note: "If its Nazgul is eliminated in combat, cycle it instead along with any wielded items" }],
    },
  ],
  "black-breath-159": [
    { timing: "useAction", instructions: [{ type: "cycleSelf" }, { type: "addCorruption", count: 1 }] },
  ],
  "black-riders-mount-160": [
    { timing: "whenPlayed", instructions: [{ type: "moveWielder", destination: "path" }] },
  ],
  "fell-beast-161": [
    { timing: "whenPlayed", instructions: [{ type: "moveWielder", destination: "battleground" }] },
  ],
  "morgul-blade-162": [
    { timing: "useAction", instructions: [{ type: "eliminateSelf" }, { type: "addCorruption", count: 1 }] },
  ],
  "the-black-captain-163": [
    {
      timing: "whenPlayed",
      instructions: [
        { type: "activateBattleground", selector: { type: "faction", faction: "mordor" }, reactivate: true },
        { type: "moveWielder", destination: "battleground" },
      ],
    },
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
