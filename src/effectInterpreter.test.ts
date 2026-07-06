import { describe, expect, it } from "vitest";

import { applyCardEffectScripts } from "./effectInterpreter";
import { createGame } from "./game";
import { assertGameInvariants } from "./invariants";

describe("card effect interpreter", () => {
  it("executes automatic draw effects", () => {
    const state = createGame("effect-draw");
    const before = state.players.aragorn.hand.length;

    const next = applyCardEffectScripts(state, {
      cardId: "boromir-39",
      timing: "whenPlayed",
      controller: "aragorn",
    });

    expect(next.players.aragorn.hand.length).toBe(before + 1);
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("executes automatic corruption effects", () => {
    const state = createGame("effect-corruption");

    const next = applyCardEffectScripts(state, {
      cardId: "smeagol-92",
      timing: "useAction",
      controller: "frodo",
    });

    expect(next.corruption.tokens).toBe(state.corruption.tokens + 1);
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("queues pending decisions for mandatory forsake effects", () => {
    const state = createGame("effect-pending");

    const next = applyCardEffectScripts(state, {
      cardId: "balrog-118",
      timing: "whenPlayedOrMoved",
      controller: "saruman",
    });

    expect(next.pendingDecisions.filter((decision) => decision.type === "forsake")).toHaveLength(2);
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("queues draw-play-cycle-rest flows", () => {
    const state = createGame("effect-draw-play-cycle-rest");

    const next = applyCardEffectScripts(state, {
      cardId: "the-ringwraiths-are-abroad-164",
      timing: "whenPlayed",
      controller: "witchKing",
    });

    expect(next.players.witchKing.hand.length).toBe(state.players.witchKing.hand.length + 7);
    expect(
      next.pendingDecisions.some((decision) => decision.type === "drawPlayCycleRest"),
    ).toBe(true);
    expect(assertGameInvariants(next)).toEqual([]);
  });
});
