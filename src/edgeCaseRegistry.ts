export type EdgeCaseStatus = "implemented" | "scaffolded" | "blocked";

export interface EdgeCaseRecord {
  readonly id: string;
  readonly category:
    | "archive"
    | "attachment"
    | "bgg"
    | "card"
    | "combat"
    | "fuzz"
    | "invariant"
    | "location"
    | "rules"
    | "scenario";
  readonly title: string;
  readonly status: EdgeCaseStatus;
  readonly sources: readonly string[];
}

export const edgeCaseRegistry: readonly EdgeCaseRecord[] = [
  {
    id: "rules-last-card-forsake",
    category: "rules",
    title: "Playing the last hand card falls back to forsake.",
    status: "implemented",
    sources: ["rules:151-158", "bgg:2954283"],
  },
  {
    id: "rules-forsake-choice",
    category: "rules",
    title: "Forsake can choose hand, reserve, or top of draw deck.",
    status: "implemented",
    sources: ["rules:385-395"],
  },
  {
    id: "rules-pass-legality",
    category: "rules",
    title: "Pass is legal only by carryover or enemy-hand condition.",
    status: "implemented",
    sources: ["rules:142-145", "bgg:2979005", "bgg:3214050"],
  },
  {
    id: "rules-winnow-hand-only",
    category: "rules",
    title: "Winnow eliminates exactly two different hand cards to draw one.",
    status: "implemented",
    sources: ["rules:138", "rules:242", "bgg:3061596", "bgg:3026810"],
  },
  {
    id: "attachment-item-wielder",
    category: "attachment",
    title: "Items attach only to indicated in-play character wielders.",
    status: "implemented",
    sources: ["rules:173-177", "bgg:2951361", "bgg:3114689"],
  },
  {
    id: "attachment-leaves-with-wielder",
    category: "attachment",
    title: "Attached items leave play with the wielder.",
    status: "implemented",
    sources: ["rules:178-186"],
  },
  {
    id: "location-activated-path-history",
    category: "location",
    title: "Specific paths cannot be activated more than once per game.",
    status: "scaffolded",
    sources: ["rules:116-121", "bgg:3021148", "bgg:3121693"],
  },
  {
    id: "location-scoring-areas",
    category: "location",
    title: "Scored paths and battlegrounds are tracked by side.",
    status: "scaffolded",
    sources: ["rules:420-444", "bgg:3036614", "bgg:3060247"],
  },
  {
    id: "combat-corruption-path",
    category: "combat",
    title: "Shadow path success records corruption and facedown path scoring.",
    status: "scaffolded",
    sources: ["rules:286-293", "rules:426-440", "bgg:3074641", "bgg:3246013"],
  },
  {
    id: "combat-support-assignment",
    category: "combat",
    title: "Leadership icons require same-faction army support and support assignment choices.",
    status: "blocked",
    sources: ["rules:325-338", "bgg:3193261", "bgg:3224992"],
  },
  {
    id: "combat-loss-pending-decision",
    category: "combat",
    title: "Defender loss assignment must be a pending decision when ambiguous.",
    status: "scaffolded",
    sources: ["rules:270-285", "rules:310-320"],
  },
  {
    id: "location-reactivate-battleground",
    category: "location",
    title: "Reactivation takes battleground from scoring area and can ignore defense.",
    status: "blocked",
    sources: ["rules:99-101", "rules:302-304", "bgg:3017468", "bgg:3107840"],
  },
  {
    id: "card-draw-play-cycle-rest",
    category: "card",
    title: "Draw N, play up to M, cycle rest can satisfy play costs.",
    status: "blocked",
    sources: ["rules:213-216", "bgg:3402025", "bgg:3716703"],
  },
  {
    id: "card-replacement-effects",
    category: "card",
    title: "Cycle-instead-of-eliminate/forsake replacement effects.",
    status: "blocked",
    sources: ["cards:69", "cards:73", "cards:89", "cards:107", "cards:144"],
  },
  {
    id: "scenario-ring-rules",
    category: "scenario",
    title: "Ring token rules vary by scenario.",
    status: "blocked",
    sources: ["rules:744-747", "rules:765-769", "rules:798-801"],
  },
  {
    id: "invariant-card-location",
    category: "invariant",
    title: "Every card has exactly one physical location.",
    status: "implemented",
    sources: ["docs:rules-edge-case-plan"],
  },
  {
    id: "fuzz-seeded-command-stream",
    category: "fuzz",
    title: "Seeded generated command streams preserve invariants.",
    status: "implemented",
    sources: ["docs:rules-edge-case-plan"],
  },
  {
    id: "archive-drift-detection",
    category: "archive",
    title: "Archive replay catches command and metadata drift.",
    status: "implemented",
    sources: ["src/archive.test.ts"],
  },
  {
    id: "bgg-items-reserve",
    category: "bgg",
    title: "Items, reserve, movement, and active character ambiguity.",
    status: "scaffolded",
    sources: ["bgg:3023399", "bgg:3052983", "bgg:3718707"],
  },
  {
    id: "bgg-no-card-combat",
    category: "bgg",
    title: "Combat with no cards or uncontested cards needs oracle fixture.",
    status: "blocked",
    sources: ["bgg:2968253", "bgg:3036060", "bgg:3148051"],
  },
];
