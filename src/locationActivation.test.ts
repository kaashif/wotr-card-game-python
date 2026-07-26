import { describe, expect, it } from "vitest";

import { battlegroundDefinitions, pathDefinitions } from "./data";
import {
  createGame,
  eligiblePathsByNumber,
  resolveCombat,
} from "./game";
import { assertGameInvariants } from "./invariants";

describe("round location activation", () => {
  it("randomizes the first path deterministically from the path 1 cards", () => {
    const first = createGame("random-path-seed");
    const repeated = createGame("random-path-seed");
    const selectedAcrossSeeds = new Set(
      Array.from({ length: 24 }, (_, index) =>
        createGame(`random-path-${index}`).activePath?.id,
      ),
    );

    expect(first.activePath?.id).toBe(repeated.activePath?.id);
    expect(pathNumber(first.activePath?.id)).toBe(1);
    expect(selectedAcrossSeeds.size).toBeGreaterThan(1);
  });

  it("falls back to the other side's battleground deck", () => {
    const fallback = battlegroundDefinitions.find(
      (battleground) => battleground.side === "shadow",
    );
    expect(fallback).toBeDefined();
    if (fallback === undefined) {
      return;
    }

    const state = {
      ...createGame("battleground-fallback"),
      round: 2,
      currentPathNumber: 2,
      activePath: null,
      activeBattleground: null,
      battlegroundDecks: {
        free: [],
        shadow: [fallback.id],
      },
    } as const;
    const next = resolveCombat(state);

    expect(next.round).toBe(3);
    expect(next.activeBattleground?.id).toBe(fallback.id);
    expect(next.battlegroundDecks.shadow).toEqual([]);
    expect(next.eventLog.at(-1)).toMatchObject({
      type: "roundStarted",
      round: 3,
      battlegroundId: fallback.id,
    });
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("starts without a battleground when both decks are empty", () => {
    const state = {
      ...createGame("no-battlegrounds"),
      round: 2,
      currentPathNumber: 2,
      activePath: null,
      activeBattleground: null,
      battlegroundDecks: {
        free: [],
        shadow: [],
      },
    } as const;
    const next = resolveCombat(state);

    expect(next.activeBattleground).toBeNull();
    expect(next.eventLog.at(-1)).toMatchObject({
      type: "roundStarted",
      round: 3,
      battlegroundId: null,
    });
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("reports only unactivated paths that remain in the path deck", () => {
    const state = createGame("eligible-path-deck");
    const candidate = state.pathDeck.find((id) => pathNumber(id) === 2);
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }

    const withoutCandidate = {
      ...state,
      pathDeck: state.pathDeck.filter((id) => id !== candidate),
    };

    expect(eligiblePathsByNumber(withoutCandidate, 2)).not.toContain(candidate);
  });
});

function pathNumber(pathId: string | undefined): number | undefined {
  return pathDefinitions.find((path) => path.id === pathId)?.pathNumber;
}
