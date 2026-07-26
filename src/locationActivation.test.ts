import { describe, expect, it } from "vitest";

import { battlegroundDefinitions, pathDefinitions } from "./data";
import {
  activatePathById,
  createGame,
  eligiblePathsByNumber,
  getCard,
  getCardDefinition,
  resolveCombat,
  tryActivateBattlegroundFromDeck,
  tryActivatePathByChoice,
  tryReactivateBattleground,
  tryResolveForsakeDecision,
  tryResolveCycleFromHandDecision,
  tryResolveDrawPlayCycleRestDecision,
} from "./game";
import { assertGameInvariants } from "./invariants";
import type { GameState, PlayerId } from "./types";

describe("round location activation", () => {
  it("uses the scheduled side's battleground deck when it has cards", () => {
    const state = createGame("scheduled-battleground-side");
    const battleground = battlegroundDefinitions.find(
      (definition) => definition.id === state.activeBattleground?.id,
    );

    expect(state.round).toBe(1);
    expect(battleground?.side).toBe("free");
    expect(state.battlegroundDecks.shadow).toHaveLength(
      battlegroundDefinitions.filter(
        (definition) => definition.side === "shadow",
      ).length,
    );
  });

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
    expect(next.eventLog).toContainEqual(expect.objectContaining({
      type: "roundStarted",
      round: 3,
      battlegroundId: fallback.id,
    }));
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
    expect(next.eventLog).toContainEqual(expect.objectContaining({
      type: "roundStarted",
      round: 3,
      battlegroundId: null,
    }));
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

  it("activates a specific battleground from a deck and reshuffles the remainder", () => {
    const state = createGame("specific-battleground");
    const target = state.battlegroundDecks.shadow[1];
    expect(target).toBeDefined();
    if (target === undefined) {
      return;
    }
    const originalRemaining = state.battlegroundDecks.shadow.filter(
      (id) => id !== target,
    );

    const result = tryActivateBattlegroundFromDeck(state, target);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.state.additionalActiveBattlegrounds.map(
          (battleground) => battleground.id,
        ),
      ).toContain(target);
      expect(result.state.battlegroundDecks.shadow).not.toContain(target);
      expect(result.state.battlegroundDecks.shadow).not.toEqual(
        originalRemaining,
      );
      expect(result.events).toContainEqual({
        type: "battlegroundActivated",
        battlegroundId: target,
        reactivated: false,
        ignorePrintedDefense: false,
      });
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("reactivates from a scoring area and records cross-side defense ignore", () => {
    const base = createGame("reactivate-battleground");
    const target = base.battlegroundDecks.free[0];
    expect(target).toBeDefined();
    if (target === undefined) {
      return;
    }
    const state = {
      ...base,
      battlegroundDecks: {
        ...base.battlegroundDecks,
        free: base.battlegroundDecks.free.filter((id) => id !== target),
      },
      scoringAreas: {
        ...base.scoringAreas,
        battlegrounds: {
          ...base.scoringAreas.battlegrounds,
          free: [target],
        },
      },
    };

    const result = tryReactivateBattleground(state, target, "shadow");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.scoringAreas.battlegrounds.free).not.toContain(target);
      expect(result.state.additionalActiveBattlegrounds.at(-1)).toMatchObject({
        id: target,
        ignorePrintedDefense: true,
      });
      expect(result.events).toContainEqual({
        type: "battlegroundActivated",
        battlegroundId: target,
        reactivated: true,
        ignorePrintedDefense: true,
      });
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("resolves every active battleground before path combat", () => {
    const base = createGame("multiple-battleground-combat");
    const firstId = base.activeBattleground?.id;
    const secondId = base.battlegroundDecks.shadow[0];
    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    if (firstId === undefined || secondId === undefined) {
      return;
    }
    const activated = tryActivateBattlegroundFromDeck(base, secondId);
    expect(activated.ok).toBe(true);
    if (!activated.ok) {
      return;
    }

    const next = resolveCombat({
      ...activated.state,
      activePath: null,
    });
    const scored = [
      ...next.scoringAreas.battlegrounds.free,
      ...next.scoringAreas.battlegrounds.shadow,
    ];

    expect(scored).toEqual(expect.arrayContaining([firstId, secondId]));
    expect(next.additionalActiveBattlegrounds).toEqual([]);
    expect(assertGameInvariants(next)).toEqual([]);
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

  it("applies mandatory draw text when a path activates", () => {
    const base = createGame("bag-end-activation-text");
    const state = {
      ...base,
      activePath: {
        id: "gildors-encampment",
        cards: [],
        attackTokens: 0,
        defenseTokens: 0,
      },
      pathDeck: pathDefinitions
        .map((path) => path.id)
        .filter((id) => id !== "gildors-encampment"),
      activatedPaths: ["gildors-encampment"],
    };
    const before = state.players.frodo.hand.length;

    const next = activatePathById(state, "bag-end");

    expect(next?.players.frodo.hand).toHaveLength(before + 2);
    expect(next?.eventLog).toContainEqual({
      type: "cardsDrawn",
      playerId: "frodo",
      count: 2,
    });
    if (next !== null) {
      expect(assertGameInvariants(next)).toEqual([]);
    }
  });

  it("applies mandatory draw text for deck activation and reactivation", () => {
    const base = createGame("battleground-activation-text");
    const fromDeck = tryActivateBattlegroundFromDeck(
      {
        ...base,
        battlegroundDecks: {
          ...base.battlegroundDecks,
          shadow: [
            "harad",
            ...base.battlegroundDecks.shadow.filter((id) => id !== "harad"),
          ],
        },
      },
      "harad",
    );

    expect(fromDeck.ok).toBe(true);
    if (!fromDeck.ok) {
      return;
    }
    expect(fromDeck.state.players.witchKing.hand).toHaveLength(
      base.players.witchKing.hand.length + 1,
    );
    expect(fromDeck.state.players.saruman.hand).toHaveLength(
      base.players.saruman.hand.length + 1,
    );

    const beforeReactivation = fromDeck.state.players.saruman.hand.length;
    const reactivationState = {
      ...fromDeck.state,
      battlegroundDecks: {
        ...fromDeck.state.battlegroundDecks,
        shadow: fromDeck.state.battlegroundDecks.shadow.filter(
          (id) => id !== "moria",
        ),
      },
      scoringAreas: {
        ...fromDeck.state.scoringAreas,
        battlegrounds: {
          ...fromDeck.state.scoringAreas.battlegrounds,
          shadow: ["moria"],
        },
      },
    };
    const reactivated = tryReactivateBattleground(
      reactivationState,
      "moria",
      "shadow",
    );

    expect(reactivated.ok).toBe(true);
    if (reactivated.ok) {
      expect(reactivated.state.players.saruman.hand).toHaveLength(
        beforeReactivation + 2,
      );
      expect(assertGameInvariants(reactivated.state)).toEqual([]);
    }
  });

  it("adds Morgai's mandatory attack marker on activation", () => {
    const base = createGame("morgai-activation-text");
    const state = {
      ...base,
      currentPathNumber: 8,
      activePath: {
        id: "morgul-vale",
        cards: [],
        attackTokens: 0,
        defenseTokens: 0,
      },
      pathDeck: ["morgai"],
      activatedPaths: ["morgul-vale"],
    };

    const next = activatePathById(state, "morgai");

    expect(next?.activePath).toMatchObject({
      id: "morgai",
      attackTokens: 1,
    });
    if (next !== null) {
      expect(assertGameInvariants(next)).toEqual([]);
    }
  });

  it("queues mandatory forsakes for both Free Peoples players", () => {
    const base = createGame("old-forest-forsakes");
    const state = {
      ...base,
      pendingDecisions: [],
      currentPathNumber: 2,
      activePath: {
        id: "inn-of-the-prancing-pony",
        cards: [],
        attackTokens: 0,
        defenseTokens: 0,
      },
      pathDeck: ["the-old-forest"],
      activatedPaths: ["inn-of-the-prancing-pony"],
    };

    const next = activatePathById(state, "the-old-forest");

    expect(next?.pendingDecisions).toMatchObject([
      {
        type: "forsake",
        playerId: "frodo",
        minimum: 1,
        source: "location:the-old-forest",
      },
      {
        type: "forsake",
        playerId: "aragorn",
        minimum: 1,
        source: "location:the-old-forest",
      },
    ]);
    if (next !== null) {
      expect(assertGameInvariants(next)).toEqual([]);
    }
  });

  it("draws three after each Fords of Bruinen forsake resolves", () => {
    const base = createGame("fords-forsake-draw");
    const state = {
      ...base,
      pendingDecisions: [],
      currentPathNumber: 3,
      activePath: {
        id: "imladris-rivendel",
        cards: [],
        attackTokens: 0,
        defenseTokens: 0,
      },
      pathDeck: ["fords-of-bruinen"],
      activatedPaths: ["imladris-rivendel"],
    };
    const activated = activatePathById(state, "fords-of-bruinen");
    expect(activated).not.toBeNull();
    if (activated === null) {
      return;
    }
    const card = activated.players.frodo.hand.find(
      (cardId) =>
        !cardId.includes("frodo-baggins-69") &&
        !cardId.includes("bilbo-baggins-73"),
    );
    expect(card).toBeDefined();
    if (card === undefined) {
      return;
    }
    const before = activated.players.frodo.hand.length;

    const result = tryResolveForsakeDecision(activated, "frodo", [
      { source: "hand", cardId: card },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players.frodo.hand).toHaveLength(before + 2);
      expect(result.state.pendingDecisions[0]).toMatchObject({
        type: "forsake",
        playerId: "aragorn",
      });
      expect(result.events).toContainEqual({
        type: "cardsDrawn",
        playerId: "frodo",
        count: 3,
      });
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("lets a player decline an optional location forsake without its benefit", () => {
    const activated = activatePathById(
      optionalPathState("decline-osgiliath", "the-cross-roads", "osgiliath", 7),
      "osgiliath",
    );
    expect(activated?.pendingDecisions[0]).toMatchObject({
      type: "forsake",
      playerId: "aragorn",
      minimum: 0,
      maximum: 1,
    });
    if (activated === null) {
      return;
    }
    const before = activated.players.aragorn.hand.length;

    const result = tryResolveForsakeDecision(activated, "aragorn", []);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players.aragorn.hand).toHaveLength(before);
      expect(result.state.pendingDecisions).toEqual([]);
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("grants an optional location benefit only after a forsake", () => {
    const activated = activatePathById(
      optionalPathState("accept-osgiliath", "the-cross-roads", "osgiliath", 7),
      "osgiliath",
    );
    expect(activated).not.toBeNull();
    if (activated === null) {
      return;
    }
    const card = activated.players.aragorn.hand[0];
    expect(card).toBeDefined();
    if (card === undefined) {
      return;
    }
    const before = activated.players.aragorn.hand.length;

    const result = tryResolveForsakeDecision(activated, "aragorn", [
      { source: "hand", cardId: card },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players.aragorn.hand).toHaveLength(before + 2);
      expect(result.events).toContainEqual({
        type: "cardsDrawn",
        playerId: "aragorn",
        count: 3,
      });
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("adds a Doors of Durin attack marker only when its cost is paid", () => {
    const activated = activatePathById(
      optionalPathState(
        "doors-of-durin-option",
        "caradhras",
        "the-doors-of-durin",
        4,
      ),
      "the-doors-of-durin",
    );
    expect(activated).not.toBeNull();
    if (activated === null) {
      return;
    }
    const card = activated.players.saruman.hand[0];
    expect(card).toBeDefined();
    if (card === undefined) {
      return;
    }

    const result = tryResolveForsakeDecision(activated, "saruman", [
      { source: "hand", cardId: card },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.activePath?.attackTokens).toBe(1);
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("draws and then requires the printed hand cycle", () => {
    const state = optionalPathState(
      "gildor-draw-cycle",
      "bag-end",
      "gildors-encampment",
      1,
    );
    const before = state.players.aragorn.hand.length;
    const activated = activatePathById(
      state,
      "gildors-encampment",
    );
    expect(activated).not.toBeNull();
    if (activated === null) {
      return;
    }
    expect(activated.players.aragorn.hand).toHaveLength(before + 1);
    expect(activated.pendingDecisions[0]).toMatchObject({
      type: "cycleFromHand",
      playerId: "aragorn",
      minimum: 1,
      maximum: 1,
    });
    const card = activated.players.aragorn.hand[0];
    expect(card).toBeDefined();
    if (card === undefined) {
      return;
    }

    const result = tryResolveCycleFromHandDecision(
      activated,
      "aragorn",
      [card],
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players.aragorn.hand).toHaveLength(before);
      expect(result.state.players.aragorn.cycle).toContain(card);
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("queues Dimrill Dale's mandatory cycles for both Shadow players", () => {
    const activated = activatePathById(
      optionalPathState(
        "dimrill-cycles",
        "egladil",
        "dimrill-dale",
        5,
      ),
      "dimrill-dale",
    );

    expect(activated?.pendingDecisions).toMatchObject([
      {
        type: "cycleFromHand",
        playerId: "witchKing",
        minimum: 2,
      },
      {
        type: "cycleFromHand",
        playerId: "saruman",
        minimum: 2,
      },
    ]);
    if (activated !== null) {
      expect(assertGameInvariants(activated)).toEqual([]);
    }
  });

  it("draws five, plays an eligible card to the required zone, and cycles the rest", () => {
    const base = createGame("minas-morgul-draw-play");
    const owned = ownedCards(base, "witchKing");
    const nazgul = owned.find((instanceId) => {
      const card = getCardDefinition(getCard(base, instanceId).cardId);
      return (
        card.type === "character" &&
        card.title
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .includes("nazgul")
      );
    });
    expect(nazgul).toBeDefined();
    if (nazgul === undefined) {
      return;
    }
    const drawnCards = [
      nazgul,
      ...owned.filter((instanceId) => instanceId !== nazgul).slice(0, 4),
    ];
    const arranged = setDrawPile(base, "witchKing", drawnCards);
    const activation = tryActivateBattlegroundFromDeck(
      {
        ...arranged,
        pendingDecisions: [],
        battlegroundDecks: {
          ...arranged.battlegroundDecks,
          shadow: [
            "minas-morgul",
            ...arranged.battlegroundDecks.shadow.filter(
              (id) => id !== "minas-morgul",
            ),
          ],
        },
      },
      "minas-morgul",
    );

    expect(activation.ok).toBe(true);
    if (!activation.ok) {
      return;
    }
    expect(activation.state.pendingDecisions[0]).toMatchObject({
      type: "drawPlayCycleRest",
      playerId: "witchKing",
      drawnCards,
      playableCards: expect.arrayContaining([nazgul]),
      allowedDestinations: ["reserve"],
    });

    const result = tryResolveDrawPlayCycleRestDecision(
      activation.state,
      "witchKing",
      [{ cardId: nazgul, destination: "reserve" }],
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players.witchKing.reserve).toContain(nazgul);
      for (const cardId of drawnCards.filter((id) => id !== nazgul)) {
        expect(result.state.players.witchKing.cycle).toContain(cardId);
      }
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });
});

function optionalPathState(
  seed: string,
  activePathId: string,
  nextPathId: string,
  pathNumberValue: number,
) {
  const base = createGame(seed);
  return {
    ...base,
    pendingDecisions: [],
    currentPathNumber: pathNumberValue,
    activePath: {
      id: activePathId,
      cards: [],
      attackTokens: 0,
      defenseTokens: 0,
    },
    pathDeck: [nextPathId],
    activatedPaths: [activePathId],
  };
}

function pathNumber(pathId: string | undefined): number | undefined {
  return pathDefinitions.find((path) => path.id === pathId)?.pathNumber;
}

function ownedCards(
  state: GameState,
  playerId: PlayerId,
): readonly string[] {
  const player = state.players[playerId];
  return [
    ...player.draw,
    ...player.hand,
    ...player.cycle,
    ...player.eliminated,
    ...player.reserve,
  ];
}

function setDrawPile(
  state: GameState,
  playerId: PlayerId,
  draw: readonly string[],
): GameState {
  const player = state.players[playerId];
  const placed = new Set(draw);
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        draw,
        hand: [],
        cycle: [],
        reserve: [],
        eliminated: ownedCards(state, playerId).filter(
          (instanceId) => !placed.has(instanceId),
        ),
      },
    },
  };
}
