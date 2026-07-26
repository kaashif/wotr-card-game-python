import { describe, expect, it } from "vitest";

import { hashGameState } from "./archive";
import {
  createGame,
  tryActivatePathByChoice,
  tryAttachItem,
  tryForsake,
  tryMoveFromReserve,
  tryPass,
  tryPlayCard,
  tryResolveCombatLossDecision,
  tryResolveDrawPlayCycleRestDecision,
  tryResolveForsakeDecision,
  tryResolveSearchDecision,
  tryWinnow,
} from "./game";
import type { CommandResult } from "./types";

describe("command contracts", () => {
  it("preserves the exact state and state hash for every rejected command API", () => {
    const state = createGame("rejected-command-contract");
    const missing = "missing-card";
    const rejectedResults: readonly CommandResult[] = [
      tryPlayCard(state, state.activePlayer, missing, "reserve"),
      tryAttachItem(state, state.activePlayer, missing, missing),
      tryMoveFromReserve(state, state.activePlayer, missing, "path"),
      tryWinnow(state, state.activePlayer, missing, missing),
      tryForsake(state, state.activePlayer, "hand", missing),
      tryActivatePathByChoice(state, missing, "same-number"),
      tryResolveForsakeDecision(state, state.activePlayer, []),
      tryResolveSearchDecision(state, state.activePlayer, []),
      tryResolveDrawPlayCycleRestDecision(state, state.activePlayer, []),
      tryResolveCombatLossDecision(state, []),
    ];
    const originalHash = hashGameState(state);

    for (const result of rejectedResults) {
      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
      expect(hashGameState(result.state)).toBe(originalHash);
    }
  });

  it("records at least one event for accepted commands", () => {
    const base = createGame("accepted-command-contract");
    const state = {
      ...base,
      activePlayer: "frodo" as const,
      players: {
        ...base.players,
        frodo: {
          ...base.players.frodo,
          hand: base.players.frodo.hand.slice(0, 2),
          eliminated: [
            ...base.players.frodo.eliminated,
            ...base.players.frodo.hand.slice(2),
          ],
        },
      },
    };
    const [first, second] = state.players.frodo.hand;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) {
      return;
    }

    const result = tryWinnow(state, "frodo", first, second);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.state.eventLog.slice(-result.events.length)).toEqual(
        result.events,
      );
    }
  });

  it("rejects passing without changing state when pass conditions are unmet", () => {
    const state = {
      ...createGame("pass-rejection-contract"),
      activePlayer: "frodo" as const,
    };
    const before = hashGameState(state);

    const result = tryPass(state);

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(hashGameState(result.state)).toBe(before);
  });
});
