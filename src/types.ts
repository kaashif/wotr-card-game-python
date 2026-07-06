export type Side = "free" | "shadow";

export type PlayerId = "frodo" | "aragorn" | "witchKing" | "saruman";

export type Faction =
  | "dunedain"
  | "dwarf"
  | "elf"
  | "hobbit"
  | "rohan"
  | "wizard"
  | "isengard"
  | "monstrous"
  | "mordor"
  | "southron";

export type CardType = "army" | "character" | "event" | "item";

export type Zone =
  | "draw"
  | "hand"
  | "cycle"
  | "eliminated"
  | "reserve"
  | "battleground"
  | "path";

export type Phase = "setup" | "action" | "combat" | "gameOver";

export type PlayDestination = "reserve" | "battleground" | "path";

export type ForsakeSource = "hand" | "reserve" | "draw";

export interface CardDefinition {
  readonly id: string;
  readonly title: string;
  readonly owner: PlayerId;
  readonly faction: Faction;
  readonly type: CardType;
  readonly battlegroundAttack: number;
  readonly battlegroundDefense: number;
  readonly leadershipAttack: number;
  readonly leadershipDefense: number;
  readonly pathIcons: number;
  readonly allowedPaths: readonly number[];
  readonly allowedWielders: readonly string[];
  readonly text: string;
  readonly sourceLine: number;
}

export interface CardInstance {
  readonly instanceId: string;
  readonly cardId: string;
}

export interface PlayerDefinition {
  readonly id: PlayerId;
  readonly name: string;
  readonly side: Side;
  readonly factions: readonly Faction[];
  readonly drawCount: number;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly draw: readonly string[];
  readonly hand: readonly string[];
  readonly cycle: readonly string[];
  readonly eliminated: readonly string[];
  readonly reserve: readonly string[];
  readonly usedRingToken: boolean;
  readonly passed: boolean;
}

export interface BattlegroundDefinition {
  readonly id: string;
  readonly title: string;
  readonly side: Side;
  readonly defenseIcons: number;
  readonly defendingFactions: readonly Faction[];
  readonly attackingFactions: readonly Faction[];
  readonly victoryPoints: number;
  readonly text: string;
  readonly sourceLine: number;
}

export interface ActiveBattleground {
  readonly id: string;
  readonly cards: readonly string[];
  readonly attackTokens: number;
  readonly defenseTokens: number;
}

export interface PathDefinition {
  readonly id: string;
  readonly title: string;
  readonly pathNumber: number;
  readonly defenseIcons: number;
  readonly victoryPoints: number;
  readonly text: string;
  readonly sourceLine: number;
}

export interface ActivePath {
  readonly id: string;
  readonly cards: readonly string[];
  readonly attackTokens: number;
  readonly defenseTokens: number;
}

export interface ScoreState {
  readonly free: number;
  readonly shadow: number;
}

export interface ScoredPath {
  readonly id: string;
  readonly points: number;
  readonly facedown: boolean;
}

export interface ScoringAreaState {
  readonly battlegrounds: Readonly<Record<Side, readonly string[]>>;
  readonly paths: Readonly<Record<Side, readonly ScoredPath[]>>;
}

export interface CorruptionState {
  readonly tokens: number;
}

export interface LogEntry {
  readonly id: number;
  readonly message: string;
}

export interface SelectionState {
  readonly playerId: PlayerId;
  readonly cardId: string | null;
}

export interface RoundMemory {
  readonly playedToReserve: readonly string[];
  readonly playedCharacterOrItemCards: readonly string[];
}

export type AttachmentState = Readonly<Record<string, readonly string[]>>;

export type PendingDecision =
  | {
      readonly type: "forsake";
      readonly playerId: PlayerId;
      readonly reason: string;
      readonly minimum: number;
      readonly source?: string;
    }
  | {
      readonly type: "combatLosses";
      readonly side: Side;
      readonly locationType: "path" | "battleground";
      readonly locationId: string;
      readonly attackToCancel: number;
      readonly candidates: readonly string[];
      readonly source?: string;
    }
  | {
      readonly type: "drawPlayCycleRest";
      readonly playerId: PlayerId;
      readonly drawnCards: readonly string[];
      readonly playableCards: readonly string[];
      readonly maxPlays: number;
      readonly source?: string;
    }
  | {
      readonly type: "search";
      readonly playerId: PlayerId;
      readonly zones: readonly Zone[];
      readonly choices: readonly string[];
      readonly source?: string;
    };

export type GameEvent =
  | { readonly type: "cardPlayed"; readonly playerId: PlayerId; readonly cardId: string; readonly destination: PlayDestination }
  | { readonly type: "cardMoved"; readonly playerId: PlayerId; readonly cardId: string; readonly destination: Exclude<PlayDestination, "reserve"> }
  | { readonly type: "itemAttached"; readonly playerId: PlayerId; readonly itemId: string; readonly wielderId: string }
  | { readonly type: "cardCycled"; readonly playerId: PlayerId; readonly cardId: string }
  | { readonly type: "cardEliminated"; readonly playerId: PlayerId; readonly cardId: string }
  | { readonly type: "cardsDrawn"; readonly playerId: PlayerId; readonly count: number }
  | { readonly type: "cardForsaken"; readonly playerId: PlayerId; readonly source: ForsakeSource; readonly cardId?: string }
  | { readonly type: "playerPassed"; readonly playerId: PlayerId }
  | { readonly type: "ringTokenUsed"; readonly playerId: PlayerId }
  | { readonly type: "winnowed"; readonly playerId: PlayerId; readonly cards: readonly string[] }
  | { readonly type: "roundStarted"; readonly round: number; readonly pathId: string | null; readonly battlegroundId: string | null }
  | { readonly type: "pathScored"; readonly pathId: string; readonly side: Side; readonly points: number; readonly corruption: number }
  | { readonly type: "battlegroundScored"; readonly battlegroundId: string; readonly side: Side; readonly points: number }
  | { readonly type: "corruptionChanged"; readonly delta: number; readonly total: number }
  | { readonly type: "pendingDecisionCreated"; readonly decision: PendingDecision };

export interface GameState {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly round: number;
  readonly phase: Phase;
  readonly activePlayer: PlayerId;
  readonly currentPathNumber: number;
  readonly battlegroundDecks: Readonly<Record<Side, readonly string[]>>;
  readonly pathDeck: readonly string[];
  readonly activatedPaths: readonly string[];
  readonly activeBattleground: ActiveBattleground | null;
  readonly activePath: ActivePath | null;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly cards: Readonly<Record<string, CardInstance>>;
  readonly attachments: AttachmentState;
  readonly roundMemory: RoundMemory;
  readonly pendingDecisions: readonly PendingDecision[];
  readonly eventLog: readonly GameEvent[];
  readonly scoringAreas: ScoringAreaState;
  readonly corruption: CorruptionState;
  readonly score: ScoreState;
  readonly log: readonly LogEntry[];
  readonly selection: SelectionState;
}

export type RuleViolationCode =
  | "wrong-phase"
  | "wrong-player"
  | "card-not-found"
  | "card-not-in-hand"
  | "card-not-in-reserve"
  | "invalid-destination"
  | "invalid-cost"
  | "invalid-forsake-source"
  | "invalid-wielder"
  | "item-already-attached"
  | "reserve-card-played-this-round"
  | "repeat-character-or-item-this-round"
  | "pass-not-allowed"
  | "insufficient-hand-cards";

export interface RuleViolation {
  readonly code: RuleViolationCode;
  readonly message: string;
  readonly source?: string;
}

export type CommandResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly state: GameState; readonly violation: RuleViolation };

export interface GameViewModel {
  readonly state: GameState;
  readonly activePlayer: PlayerState;
  readonly selectedCard: CardInstance | null;
  readonly selectedDefinition: CardDefinition | null;
}
