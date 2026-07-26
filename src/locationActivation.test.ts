import { describe, expect, it } from "vitest";

import { battlegroundDefinitions, pathDefinitions } from "./data";
import {
  createGame,
  eligiblePathsByNumber,
  resolveCombat,
  tryActivatePathByChoice,
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

  it("chooses a different same-number path and scores the replaced path first", () => {
    const state = createGame("same-number-path");
    const replacement = eligiblePathsByNumber(state, 1)[0];
    expect(replacement).toBeDefined();
    if (replacement === undefined || state.activePath === null) {
      return;
    }

    const result = tryActivatePathByChoice(state, replacement, "same-number");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.activePath?.id).toBe(replacement);
      expect(result.state.scoringAreas.paths.free).toContainEqual(
        expect.objectContaining({ id: state.activePath.id }),
      );
      expect(result.events).toContainEqual({
        type: "pathActivated",
        pathId: replacement,
        replacedPathId: state.activePath.id,
      });
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("chooses a next-higher path and rejects paths with the wrong number", () => {
    const state = createGame("next-higher-path");
    const nextPath = eligiblePathsByNumber(state, 2)[0];
    const wrongPath = eligiblePathsByNumber(state, 3)[0];
    expect(nextPath).toBeDefined();
    expect(wrongPath).toBeDefined();
    if (nextPath === undefined || wrongPath === undefined) {
      return;
    }

    const rejected = tryActivatePathByChoice(state, wrongPath, "next-higher");
    const accepted = tryActivatePathByChoice(state, nextPath, "next-higher");

    expect(rejected).toMatchObject({
      ok: false,
      state,
      violation: { code: "path-not-eligible" },
    });
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.state.activePath?.id).toBe(nextPath);
      expect(accepted.state.currentPathNumber).toBe(2);
      expect(assertGameInvariants(accepted.state)).toEqual([]);
    }
  });

  it("rejects a choice when no eligible same-number path remains", () => {
    const state = createGame("no-same-number-path");
    const onlyCurrentNumber = {
      ...state,
      pathDeck: state.pathDeck.filter((id) => pathNumber(id) !== 1),
    };

    const result = tryActivatePathByChoice(
      onlyCurrentNumber,
      state.pathDeck[0] ?? "missing",
      "same-number",
    );

    expect(result).toMatchObject({
      ok: false,
      state: onlyCurrentNumber,
      violation: { code: "no-eligible-path" },
    });
  });

  it("handles next-higher activation of path 9 as the final path", () => {
    const base = createGame("final-path");
    const path8 = pathDefinitions.find((path) => path.pathNumber === 8);
    const path9 = pathDefinitions.find((path) => path.pathNumber === 9);
    expect(path8).toBeDefined();
    expect(path9).toBeDefined();
    if (path8 === undefined || path9 === undefined) {
      return;
    }
    const state = {
      ...base,
      currentPathNumber: 8,
      activePath: {
        id: path8.id,
        cards: [],
        attackTokens: 0,
        defenseTokens: 0,
      },
      pathDeck: [path9.id],
      activatedPaths: [path8.id],
    };

    const activated = tryActivatePathByChoice(state, path9.id, "next-higher");

    expect(activated.ok).toBe(true);
    if (activated.ok) {
      expect(activated.state.currentPathNumber).toBe(9);
      const finished = resolveCombat(activated.state);
      expect(finished.phase).toBe("gameOver");
      expect(finished.activePath).toBeNull();
      expect(assertGameInvariants(finished)).toEqual([]);
    }
  });
});

function pathNumber(pathId: string | undefined): number | undefined {
  return pathDefinitions.find((path) => path.id === pathId)?.pathNumber;
}
