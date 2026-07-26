import { describe, expect, it } from "vitest";

import { battlegroundDefinitions } from "./data";
import { createGame, resolveCombat } from "./game";
import { assertGameInvariants } from "./invariants";

describe("game end", () => {
  it("ends immediately when battleground scoring creates a ten-point gap", () => {
    const base = createGame("early-victory");
    const battleground = battlegroundDefinitions.find(
      (definition) => definition.id === base.activeBattleground?.id,
    );
    expect(battleground).toBeDefined();
    if (battleground === undefined) {
      return;
    }
    const state = {
      ...base,
      phase: "combat" as const,
      score: {
        free: 10 - battleground.victoryPoints,
        shadow: 0,
      },
    };
    const originalPath = state.activePath?.id;

    const next = resolveCombat(state);

    expect(next.phase).toBe("gameOver");
    expect(next.outcome).toEqual({
      winner: "free",
      reason: "early-score-gap",
      finalScore: { free: 10, shadow: 0 },
    });
    expect(next.activePath?.id).toBe(originalPath);
    expect(next.scoringAreas.paths.free).toEqual([]);
    expect(next.eventLog.at(-1)).toMatchObject({ type: "gameEnded" });
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("awards a tied Trilogy final score to Shadow", () => {
    const state = {
      ...createGame("final-tie"),
      phase: "combat" as const,
      currentPathNumber: 9,
      activeBattleground: null,
      additionalActiveBattlegrounds: [],
      activePath: null,
      score: { free: 8, shadow: 8 },
    };

    const next = resolveCombat(state);

    expect(next.outcome).toEqual({
      winner: "shadow",
      reason: "final-scoring",
      finalScore: { free: 8, shadow: 8 },
    });
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("awards final scoring to the side with the higher score", () => {
    const state = {
      ...createGame("final-free-win"),
      phase: "combat" as const,
      currentPathNumber: 9,
      activeBattleground: null,
      additionalActiveBattlegrounds: [],
      activePath: null,
      score: { free: 9, shadow: 7 },
    };

    const next = resolveCombat(state);

    expect(next.outcome?.winner).toBe("free");
    expect(next.outcome?.reason).toBe("final-scoring");
    expect(assertGameInvariants(next)).toEqual([]);
  });
});
