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
}

export interface ScoreState {
  readonly free: number;
  readonly shadow: number;
}

export interface LogEntry {
  readonly id: number;
  readonly message: string;
}

export interface SelectionState {
  readonly playerId: PlayerId;
  readonly cardId: string | null;
}

export interface GameState {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly round: number;
  readonly phase: Phase;
  readonly activePlayer: PlayerId;
  readonly currentPathNumber: number;
  readonly battlegroundDecks: Readonly<Record<Side, readonly string[]>>;
  readonly pathDeck: readonly string[];
  readonly activeBattleground: ActiveBattleground | null;
  readonly activePath: ActivePath | null;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly cards: Readonly<Record<string, CardInstance>>;
  readonly score: ScoreState;
  readonly log: readonly LogEntry[];
  readonly selection: SelectionState;
}

export interface GameViewModel {
  readonly state: GameState;
  readonly activePlayer: PlayerState;
  readonly selectedCard: CardInstance | null;
  readonly selectedDefinition: CardDefinition | null;
}
