import { battlegroundDefinitions, pathDefinitions, turnOrder } from "./data";
import {
  createGame,
  cycleCard,
  discardOversizedHands,
  getCard,
  getCardDefinition,
  pass,
  playCard,
  resolveCombat,
  selectCard,
  selectPlayer,
  usePlayerRingToken,
  validateState,
} from "./game";
import type {
  ActiveBattleground,
  ActivePath,
  GameState,
  PlayerId,
  PlayerState,
  PlayDestination,
  Side,
} from "./types";

type PlayerZone = "draw" | "hand" | "cycle" | "eliminated" | "reserve";

export interface CompactGameScript {
  readonly name?: string;
  readonly seed: string;
  readonly arrange?: CompactArrangement;
  readonly steps?: readonly CompactStep[];
}

export interface CompactArrangement {
  readonly round?: number;
  readonly currentPathNumber?: number;
  readonly activePlayer?: PlayerId;
  readonly activePath?: CompactActivePath | null;
  readonly activeBattleground?: CompactActiveBattleground | null;
  readonly pathDeck?: readonly string[];
  readonly battlegroundDecks?: Partial<Record<Side, readonly string[]>>;
  readonly score?: Partial<Record<Side, number>>;
  readonly players?: Partial<Record<PlayerId, Partial<Record<PlayerZone, readonly string[]>>>>;
}

export interface CompactActivePath {
  readonly id: string;
  readonly cards?: readonly string[];
}

export interface CompactActiveBattleground {
  readonly id: string;
  readonly cards?: readonly string[];
  readonly attackTokens?: number;
  readonly defenseTokens?: number;
}

export type CompactStep =
  | { readonly action: "cycle"; readonly player: PlayerId; readonly card: string }
  | { readonly action: "discardOversizedHands" }
  | { readonly action: "pass" }
  | {
      readonly action: "play";
      readonly player: PlayerId;
      readonly card: string;
      readonly destination: PlayDestination;
      readonly cost?: string;
    }
  | { readonly action: "resolveCombat" }
  | { readonly action: "ring"; readonly player: PlayerId }
  | { readonly action: "selectCard"; readonly card: string | null }
  | { readonly action: "selectPlayer"; readonly player: PlayerId };

export interface ReplayFrame {
  readonly step: number;
  readonly label: string;
  readonly state: GameState;
  readonly errors: readonly string[];
}

export interface ReplayResult {
  readonly script: CompactGameScript;
  readonly frames: readonly ReplayFrame[];
  readonly finalState: GameState;
}

export function runGameScript(script: CompactGameScript): ReplayResult {
  let state = arrangeGame(createGame(script.seed), script.arrange);
  const frames: ReplayFrame[] = [
    { step: 0, label: "initial", state, errors: validateState(state) },
  ];

  for (const [index, step] of (script.steps ?? []).entries()) {
    state = applyStep(state, step);
    frames.push({
      step: index + 1,
      label: stepLabel(step),
      state,
      errors: validateState(state),
    });
  }

  return { script, frames, finalState: state };
}

export function arrangeGame(state: GameState, arrangement: CompactArrangement = {}): GameState {
  const resolvedActivePath = resolveActivePath(state, arrangement.activePath);
  const resolvedActiveBattleground = resolveActiveBattleground(
    state,
    arrangement.activeBattleground,
  );
  let nextState: GameState = {
    ...state,
    round: arrangement.round ?? state.round,
    currentPathNumber: arrangement.currentPathNumber ?? state.currentPathNumber,
    activePlayer: arrangement.activePlayer ?? state.activePlayer,
    activePath:
      arrangement.activePath === undefined ? state.activePath : resolvedActivePath,
    activeBattleground:
      arrangement.activeBattleground === undefined
        ? state.activeBattleground
        : resolvedActiveBattleground,
    pathDeck: arrangement.pathDeck ?? state.pathDeck,
    battlegroundDecks: {
      free: arrangement.battlegroundDecks?.free ?? state.battlegroundDecks.free,
      shadow: arrangement.battlegroundDecks?.shadow ?? state.battlegroundDecks.shadow,
    },
    score: {
      free: arrangement.score?.free ?? state.score.free,
      shadow: arrangement.score?.shadow ?? state.score.shadow,
    },
  };

  const placedCards = new Set<string>([
    ...(nextState.activePath?.cards ?? []),
    ...(nextState.activeBattleground?.cards ?? []),
  ]);
  const playerZoneOverrides: Partial<Record<PlayerId, Partial<Record<PlayerZone, readonly string[]>>>> =
    {};

  for (const playerId of turnOrder) {
    const zones = arrangement.players?.[playerId];
    if (zones === undefined) {
      continue;
    }
    const resolvedZones = Object.fromEntries(
      Object.entries(zones).map(([zone, cards]) => [
        zone,
        cards.map((card) => resolveCardRef(nextState, playerId, card)),
      ]),
    ) as Partial<Record<PlayerZone, readonly string[]>>;
    playerZoneOverrides[playerId] = resolvedZones;
    for (const cards of Object.values(resolvedZones)) {
      for (const instanceId of cards) {
        placedCards.add(instanceId);
      }
    }
  }

  nextState = {
    ...nextState,
    players: Object.fromEntries(
      turnOrder.map((playerId) => {
        const player = nextState.players[playerId];
        const zones = playerZoneOverrides[playerId];
        if (zones === undefined) {
          const cleaned = removePlacedCards(player, placedCards);
          return [playerId, cleaned];
        }
        const sweptCards = [
          ...player.draw,
          ...player.hand,
          ...player.cycle,
          ...player.reserve,
        ].filter((instanceId) => !placedCards.has(instanceId));
        const keptEliminated = player.eliminated.filter(
          (instanceId) => !placedCards.has(instanceId),
        );
        return [
          playerId,
          {
            ...player,
            draw: zones.draw ?? [],
            hand: zones.hand ?? [],
            cycle: zones.cycle ?? [],
            reserve: zones.reserve ?? [],
            eliminated: zones.eliminated ?? [...keptEliminated, ...sweptCards],
          } satisfies PlayerState,
        ];
      }),
    ) as GameState["players"],
  };

  const errors = validateState(nextState);
  if (errors.length > 0) {
    throw new Error(`Invalid compact arrangement: ${errors.join("; ")}`);
  }
  return nextState;
}

export function applyStep(state: GameState, step: CompactStep): GameState {
  switch (step.action) {
    case "cycle":
      return cycleCard(state, step.player, resolveCardRef(state, step.player, step.card));
    case "discardOversizedHands":
      return discardOversizedHands(state);
    case "pass":
      return pass(state);
    case "play":
      return playCard(
        state,
        step.player,
        resolveCardRef(state, step.player, step.card),
        step.destination,
        step.cost === undefined ? undefined : resolveCardRef(state, step.player, step.cost),
      );
    case "resolveCombat":
      return resolveCombat(state);
    case "ring":
      return usePlayerRingToken(state, step.player);
    case "selectCard":
      return selectCard(
        state,
        step.card === null ? null : resolveCardRef(state, state.selection.playerId, step.card),
      );
    case "selectPlayer":
      return selectPlayer(state, step.player);
  }
}

export function exportGameScript(script: CompactGameScript): string {
  return JSON.stringify(sortForExport(script), null, 2);
}

export function renderReplay(result: ReplayResult): string {
  return result.frames.map((frame) => renderFrame(frame)).join("\n");
}

export function renderFrame(frame: ReplayFrame): string {
  const state = frame.state;
  const activePath = state.activePath?.id ?? "-";
  const activeBattleground = state.activeBattleground?.id ?? "-";
  const zoneSummary = turnOrder
    .map((playerId) => {
      const player = state.players[playerId];
      return `${playerId}:h${player.hand.length}/d${player.draw.length}/c${player.cycle.length}/r${player.reserve.length}/e${player.eliminated.length}`;
    })
    .join(" ");
  const errors = frame.errors.length === 0 ? "ok" : `errors=${frame.errors.length}`;
  return `${frame.step}. ${frame.label} | r${state.round} ${state.phase} ${state.activePlayer} score ${state.score.free}-${state.score.shadow} path=${activePath} bg=${activeBattleground} ${zoneSummary} ${errors}`;
}

export function resolveCardRef(
  state: GameState,
  playerId: PlayerId,
  cardRef: string,
): string {
  if (state.cards[cardRef] !== undefined) {
    return cardRef;
  }

  const normalized = normalizeTitle(cardRef);
  const candidates = Object.values(state.cards).filter((card) => {
    const definition = getCardDefinition(card.cardId);
    return (
      definition.owner === playerId &&
      (definition.id === cardRef || normalizeTitle(definition.title) === normalized)
    );
  });
  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one ${playerId} card for "${cardRef}", found ${candidates.length}`,
    );
  }
  return mustHave(candidates[0]).instanceId;
}

function resolveActivePath(
  state: GameState,
  activePath: CompactActivePath | null | undefined,
): ActivePath | null {
  if (activePath === undefined) {
    return state.activePath;
  }
  if (activePath === null) {
    return null;
  }
  if (!pathDefinitions.some((path) => path.id === activePath.id)) {
    throw new Error(`Unknown path: ${activePath.id}`);
  }
  return {
    id: activePath.id,
    cards: activePath.cards?.map((card) => resolveAnyCardRef(state, card)) ?? [],
  };
}

function resolveActiveBattleground(
  state: GameState,
  activeBattleground: CompactActiveBattleground | null | undefined,
): ActiveBattleground | null {
  if (activeBattleground === undefined) {
    return state.activeBattleground;
  }
  if (activeBattleground === null) {
    return null;
  }
  if (!battlegroundDefinitions.some((battleground) => battleground.id === activeBattleground.id)) {
    throw new Error(`Unknown battleground: ${activeBattleground.id}`);
  }
  return {
    id: activeBattleground.id,
    cards: activeBattleground.cards?.map((card) => resolveAnyCardRef(state, card)) ?? [],
    attackTokens: activeBattleground.attackTokens ?? 0,
    defenseTokens: activeBattleground.defenseTokens ?? 0,
  };
}

function resolveAnyCardRef(state: GameState, cardRef: string): string {
  if (state.cards[cardRef] !== undefined) {
    return cardRef;
  }
  const matches = Object.values(state.cards).filter((card) => {
    const definition = getCardDefinition(card.cardId);
    return definition.id === cardRef || normalizeTitle(definition.title) === normalizeTitle(cardRef);
  });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one card for "${cardRef}", found ${matches.length}`);
  }
  return mustHave(matches[0]).instanceId;
}

function removePlacedCards(player: PlayerState, placedCards: ReadonlySet<string>): PlayerState {
  return {
    ...player,
    draw: player.draw.filter((instanceId) => !placedCards.has(instanceId)),
    hand: player.hand.filter((instanceId) => !placedCards.has(instanceId)),
    cycle: player.cycle.filter((instanceId) => !placedCards.has(instanceId)),
    reserve: player.reserve.filter((instanceId) => !placedCards.has(instanceId)),
    eliminated: player.eliminated.filter((instanceId) => !placedCards.has(instanceId)),
  };
}

function stepLabel(step: CompactStep): string {
  switch (step.action) {
    case "cycle":
      return `${step.player} cycle ${step.card}`;
    case "discardOversizedHands":
      return "discard oversized hands";
    case "pass":
      return "pass";
    case "play":
      return `${step.player} play ${step.card} to ${step.destination}`;
    case "resolveCombat":
      return "resolve combat";
    case "ring":
      return `${step.player} ring`;
    case "selectCard":
      return `select card ${step.card ?? "-"}`;
    case "selectPlayer":
      return `select player ${step.player}`;
  }
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sortForExport(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortForExport(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortForExport(nested)]),
    );
  }
  return value;
}

function mustHave<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected value to exist");
  }
  return value;
}
