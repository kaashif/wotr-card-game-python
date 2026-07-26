import {
  canAttachItemTo,
  canMoveTo,
  canPass,
  canPlayTo,
  legalCombatLossSelections,
} from "./game";
import type {
  ForsakeChoice,
  GameState,
  PlayDestination,
  PlayerId,
} from "./types";

export interface LegalCardAction {
  readonly cardId: string;
  readonly zone: "hand" | "reserve";
  readonly destinations: readonly PlayDestination[];
  readonly wielderIds: readonly string[];
  readonly canCycle: boolean;
}

export type LegalPendingDecision =
  | {
      readonly type: "forsake";
      readonly playerId: PlayerId;
      readonly required: number;
      readonly choices: readonly ForsakeChoice[];
    }
  | {
      readonly type: "search";
      readonly playerId: PlayerId;
      readonly minimum: number;
      readonly maximum: number;
      readonly choices: readonly string[];
    }
  | {
      readonly type: "drawPlayCycleRest";
      readonly playerId: PlayerId;
      readonly drawnCards: readonly string[];
      readonly playableCards: readonly string[];
      readonly maxPlays: number;
    }
  | {
      readonly type: "combatLosses";
      readonly selections: readonly (readonly string[])[];
    };

export interface LegalActions {
  readonly playerId: PlayerId;
  readonly cardActions: readonly LegalCardAction[];
  readonly canUseRing: boolean;
  readonly winnowPairs: readonly (readonly [string, string])[];
  readonly pass: {
    readonly legal: boolean;
    readonly reason: string | null;
  };
  readonly pendingDecision: LegalPendingDecision | null;
}

export function getLegalActions(
  state: GameState,
  playerId: PlayerId = state.activePlayer,
): LegalActions {
  const pendingDecision = legalPendingDecision(state, playerId);
  if (state.pendingDecisions.length > 0) {
    return {
      playerId,
      cardActions: [],
      canUseRing: false,
      winnowPairs: [],
      pass: {
        legal: false,
        reason: "Resolve the oldest pending decision first.",
      },
      pendingDecision,
    };
  }

  const player = state.players[playerId];
  const isActionTurn =
    state.phase === "action" && state.activePlayer === playerId;
  const handActions = player.hand.map((cardId) => ({
    cardId,
    zone: "hand" as const,
    destinations: isActionTurn
      ? (["reserve", "battleground", "path"] as const).filter((destination) =>
          canPlayTo(state, playerId, cardId, destination)
        )
      : [],
    wielderIds: isActionTurn
      ? Object.keys(state.cards).filter((wielderId) =>
          canAttachItemTo(state, playerId, cardId, wielderId)
        )
      : [],
    canCycle: isActionTurn,
  }));
  const reserveActions = player.reserve.map((cardId) => ({
    cardId,
    zone: "reserve" as const,
    destinations:
      isActionTurn && !state.roundMemory.playedToReserve.includes(cardId)
        ? (["battleground", "path"] as const).filter((destination) =>
            canMoveTo(state, playerId, cardId, destination)
          )
        : [],
    wielderIds: [],
    canCycle: false,
  }));
  const passIsLegal = isActionTurn && canPass(state, playerId);

  return {
    playerId,
    cardActions: [...handActions, ...reserveActions],
    canUseRing: isActionTurn && !player.usedRingToken,
    winnowPairs: isActionTurn ? pairs(player.hand) : [],
    pass: {
      legal: passIsLegal,
      reason: passIsLegal
        ? null
        : !isActionTurn
          ? "Only the active player may pass during the action phase."
          : "Pass requires meeting the carryover or enemy-hand condition.",
    },
    pendingDecision: null,
  };
}

function legalPendingDecision(
  state: GameState,
  playerId: PlayerId,
): LegalPendingDecision | null {
  const decision = state.pendingDecisions[0];
  if (decision === undefined) {
    return null;
  }
  switch (decision.type) {
    case "forsake": {
      if (decision.playerId !== playerId) {
        return null;
      }
      const player = state.players[playerId];
      const choices: ForsakeChoice[] = [
        ...player.hand.map((cardId) => ({
          source: "hand" as const,
          cardId,
        })),
        ...player.reserve.map((cardId) => ({
          source: "reserve" as const,
          cardId,
        })),
        ...(player.draw.length + player.cycle.length > 0
          ? [{ source: "draw" as const }]
          : []),
      ];
      return {
        type: decision.type,
        playerId,
        required: Math.min(
          decision.minimum,
          player.hand.length +
            player.reserve.length +
            player.draw.length +
            player.cycle.length,
        ),
        choices,
      };
    }
    case "search":
      return decision.playerId === playerId
        ? {
            type: decision.type,
            playerId,
            minimum: decision.minimum,
            maximum: decision.maximum,
            choices: decision.choices,
          }
        : null;
    case "drawPlayCycleRest":
      return decision.playerId === playerId
        ? {
            type: decision.type,
            playerId,
            drawnCards: decision.drawnCards,
            playableCards: decision.playableCards,
            maxPlays: decision.maxPlays,
          }
        : null;
    case "combatLosses":
      return {
        type: decision.type,
        selections: legalCombatLossSelections(state),
      };
  }
}

function pairs(
  cards: readonly string[],
): readonly (readonly [string, string])[] {
  return cards.flatMap((first, firstIndex) =>
    cards.slice(firstIndex + 1).map(
      (second) => [first, second] as const,
    )
  );
}
