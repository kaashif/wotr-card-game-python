import { turnOrder } from "./data";
import type {
  ActiveBattleground,
  ActivePath,
  GameEvent,
  GameOutcome,
  GameState,
  PendingDecision,
  Phase,
  PlayerId,
  ScoreState,
  Side,
} from "./types";

export interface VisibleZone {
  readonly count: number;
  readonly cards: readonly string[] | null;
}

export interface PublicPlayerView {
  readonly id: PlayerId;
  readonly hand: VisibleZone;
  readonly draw: VisibleZone;
  readonly cycle: VisibleZone;
  readonly eliminated: VisibleZone;
  readonly reserve: VisibleZone;
  readonly usedRingToken: boolean;
  readonly passed: boolean;
}

export interface PublicGameView {
  readonly viewerId: PlayerId;
  readonly round: number;
  readonly phase: Phase;
  readonly activePlayer: PlayerId;
  readonly currentPathNumber: number;
  readonly score: ScoreState;
  readonly outcome: GameOutcome | null;
  readonly battlegroundDeckCounts: Readonly<Record<Side, number>>;
  readonly pathDeckCount: number;
  readonly activePath: ActivePath | null;
  readonly activeBattleground: ActiveBattleground | null;
  readonly additionalActiveBattlegrounds: readonly ActiveBattleground[];
  readonly players: Readonly<Record<PlayerId, PublicPlayerView>>;
  readonly pendingDecisions: readonly PublicPendingDecision[];
  readonly events: readonly PublicEvent[];
}

export type PublicPendingDecision =
  | PendingDecision
  | {
      readonly type: "search";
      readonly playerId: PlayerId;
      readonly minimum: number;
      readonly maximum: number;
      readonly choiceCount: number;
      readonly source?: string;
    }
  | {
      readonly type: "drawPlayCycleRest";
      readonly playerId: PlayerId;
      readonly drawnCount: number;
      readonly playableCount: number;
      readonly maxPlays: number;
      readonly source?: string;
    };

export type PublicEvent =
  | GameEvent
  | {
      readonly type: "pendingDecisionCreated";
      readonly decision: PublicPendingDecision;
    }
  | {
      readonly type: "cardCycled";
      readonly playerId: PlayerId;
      readonly cardId?: string;
    }
  | {
      readonly type: "cardForsaken";
      readonly playerId: PlayerId;
      readonly source: string;
      readonly cardId?: string;
    };

export function createPublicGameView(
  state: GameState,
  viewerId: PlayerId,
): PublicGameView {
  return {
    viewerId,
    round: state.round,
    phase: state.phase,
    activePlayer: state.activePlayer,
    currentPathNumber: state.currentPathNumber,
    score: state.score,
    outcome: state.outcome,
    battlegroundDeckCounts: {
      free: state.battlegroundDecks.free.length,
      shadow: state.battlegroundDecks.shadow.length,
    },
    pathDeckCount: state.pathDeck.length,
    activePath: state.activePath,
    activeBattleground: state.activeBattleground,
    additionalActiveBattlegrounds: state.additionalActiveBattlegrounds,
    players: Object.fromEntries(
      turnOrder.map((playerId) => {
        const player = state.players[playerId];
        const isViewer = playerId === viewerId;
        return [
          playerId,
          {
            id: playerId,
            hand: zone(player.hand, isViewer),
            draw: zone(player.draw, false),
            cycle: zone(player.cycle, isViewer),
            eliminated: zone(player.eliminated, isViewer),
            reserve: zone(player.reserve, true),
            usedRingToken: player.usedRingToken,
            passed: player.passed,
          },
        ];
      }),
    ) as Record<PlayerId, PublicPlayerView>,
    pendingDecisions: state.pendingDecisions.map((decision) =>
      redactDecision(decision, viewerId)
    ),
    events: state.eventLog.map((event) => redactEvent(event, viewerId)),
  };
}

function zone(cards: readonly string[], visible: boolean): VisibleZone {
  return {
    count: cards.length,
    cards: visible ? cards : null,
  };
}

function redactDecision(
  decision: PendingDecision,
  viewerId: PlayerId,
): PublicPendingDecision {
  if (decision.type === "search" && decision.playerId !== viewerId) {
    return {
      type: decision.type,
      playerId: decision.playerId,
      minimum: decision.minimum,
      maximum: decision.maximum,
      choiceCount: decision.choices.length,
      ...(decision.source === undefined ? {} : { source: decision.source }),
    };
  }
  if (
    decision.type === "drawPlayCycleRest" &&
    decision.playerId !== viewerId
  ) {
    return {
      type: decision.type,
      playerId: decision.playerId,
      drawnCount: decision.drawnCards.length,
      playableCount: decision.playableCards.length,
      maxPlays: decision.maxPlays,
      ...(decision.source === undefined ? {} : { source: decision.source }),
    };
  }
  return decision;
}

function redactEvent(event: GameEvent, viewerId: PlayerId): PublicEvent {
  if (event.type === "pendingDecisionCreated") {
    return {
      type: event.type,
      decision: redactDecision(event.decision, viewerId),
    };
  }
  if (event.type === "cardCycled" && event.playerId !== viewerId) {
    return { type: event.type, playerId: event.playerId };
  }
  if (
    event.type === "cardForsaken" &&
    event.playerId !== viewerId &&
    event.cardId !== undefined
  ) {
    return {
      type: event.type,
      playerId: event.playerId,
      source: event.source,
    };
  }
  return event;
}
