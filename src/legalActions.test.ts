import { describe, expect, it } from "vitest";

import { createGame, enqueuePendingDecision } from "./game";
import { getLegalActions } from "./legalActions";

describe("legal actions", () => {
  it("exposes exact hand destinations and pass legality for the active player", () => {
    const state = createGame("legal-actions");
    const actions = getLegalActions(state);

    expect(actions.playerId).toBe(state.activePlayer);
    expect(actions.cardActions).toHaveLength(
      state.players[state.activePlayer].hand.length,
    );
    expect(
      actions.cardActions.every(
        (action) =>
          action.zone === "hand" &&
          action.canCycle,
      ),
    ).toBe(true);
    expect(
      actions.cardActions.some((action) => action.destinations.length > 0),
    ).toBe(true);
    expect(actions.pass).toEqual({
      legal: false,
      reason: "Pass requires meeting the carryover or enemy-hand condition.",
    });
    expect(actions.canUseRing).toBe(true);
    expect(actions.winnowPairs.length).toBeGreaterThan(0);
  });

  it("exposes reserve destinations but blocks cards played this round", () => {
    const base = createGame("legal-reserve-actions");
    const playerId = base.activePlayer;
    const cardId = base.players[playerId].hand.find((instanceId) => {
      return getLegalActions(base, playerId)
        .cardActions.find((action) => action.cardId === instanceId)
        ?.destinations.includes("reserve");
    });
    expect(cardId).toBeDefined();
    if (cardId === undefined) {
      return;
    }
    const player = base.players[playerId];
    const state = {
      ...base,
      players: {
        ...base.players,
        [playerId]: {
          ...player,
          hand: player.hand.filter((id) => id !== cardId),
          reserve: [...player.reserve, cardId],
        },
      },
      roundMemory: {
        ...base.roundMemory,
        playedToReserve: [cardId],
      },
    };

    const action = getLegalActions(state, playerId).cardActions.find(
      (candidate) => candidate.cardId === cardId,
    );

    expect(action).toEqual({
      cardId,
      zone: "reserve",
      destinations: [],
      wielderIds: [],
      canCycle: false,
    });
  });

  it("blocks normal actions and exposes only the named player's decision", () => {
    const base = createGame("legal-pending-actions");
    const state = enqueuePendingDecision(base, {
      type: "search",
      playerId: "witchKing",
      zones: ["draw"],
      choices: base.players.witchKing.draw.slice(0, 2),
      minimum: 1,
      maximum: 1,
      destination: "hand",
    });

    const ownerActions = getLegalActions(state, "witchKing");
    const opponentActions = getLegalActions(state, "frodo");

    expect(ownerActions.cardActions).toEqual([]);
    expect(ownerActions.pendingDecision).toMatchObject({
      type: "search",
      choices: state.players.witchKing.draw.slice(0, 2),
    });
    expect(opponentActions.cardActions).toEqual([]);
    expect(opponentActions.pendingDecision).toBeNull();
    expect(opponentActions.pass.reason).toBe(
      "Resolve the oldest pending decision first.",
    );
  });
});
