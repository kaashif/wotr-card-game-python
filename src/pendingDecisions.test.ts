import { describe, expect, it } from "vitest";

import {
  createGame,
  enqueuePendingDecision,
  getCard,
  getCardDefinition,
  tryPass,
  tryResolveCombatLossDecision,
  tryResolveDrawPlayCycleRestDecision,
  tryResolveForsakeDecision,
  tryResolveSearchDecision,
} from "./game";
import { assertGameInvariants } from "./invariants";
import type { GameState, PlayerId } from "./types";

describe("pending decision commands", () => {
  it("resolves a multi-card forsake choice from hand and reserve", () => {
    const playerId: PlayerId = "frodo";
    const base = createGame("resolve-forsake");
    const handCard = base.players[playerId].hand[0];
    const reserveCard = base.players[playerId].hand[1];
    expect(handCard).toBeDefined();
    expect(reserveCard).toBeDefined();
    if (handCard === undefined || reserveCard === undefined) {
      return;
    }
    const arranged = moveToReserve(base, playerId, reserveCard);
    const state = enqueuePendingDecision(arranged, {
      type: "forsake",
      playerId,
      reason: "card effect",
      minimum: 2,
      source: "test:multi-forsake",
    });

    const result = tryResolveForsakeDecision(state, playerId, [
      { source: "hand", cardId: handCard },
      { source: "reserve", cardId: reserveCard },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players[playerId].eliminated).toEqual(
        expect.arrayContaining([handCard, reserveCard]),
      );
      expect(result.state.pendingDecisions).toEqual([]);
      expect(result.events.at(-1)).toEqual({
        type: "pendingDecisionResolved",
        decisionType: "forsake",
        playerId,
      });
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("forsakes repeatedly from the top of draw and recycles when needed", () => {
    const playerId: PlayerId = "aragorn";
    const base = createGame("resolve-draw-forsake");
    const first = base.players[playerId].draw[0];
    const recycled = base.players[playerId].cycle[0];
    expect(first).toBeDefined();
    expect(recycled).toBeDefined();
    if (first === undefined || recycled === undefined) {
      return;
    }
    const state = enqueuePendingDecision(
      setAvailableCards(base, playerId, {
        draw: [first],
        cycle: [recycled],
      }),
      {
        type: "forsake",
        playerId,
        reason: "card effect",
        minimum: 2,
      },
    );

    const result = tryResolveForsakeDecision(state, playerId, [
      { source: "draw" },
      { source: "draw" },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players[playerId].eliminated).toEqual(
        expect.arrayContaining([first, recycled]),
      );
      expect(result.state.pendingDecisions).toEqual([]);
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("requires only the available cards when a mandatory forsake cannot be fully paid", () => {
    const playerId: PlayerId = "saruman";
    const base = createGame("short-forsake");
    const onlyCard = base.players[playerId].hand[0];
    expect(onlyCard).toBeDefined();
    if (onlyCard === undefined) {
      return;
    }
    const state = enqueuePendingDecision(
      setAvailableCards(base, playerId, { hand: [onlyCard] }),
      {
        type: "forsake",
        playerId,
        reason: "mandatory effect",
        minimum: 3,
      },
    );

    const result = tryResolveForsakeDecision(state, playerId, [
      { source: "hand", cardId: onlyCard },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.pendingDecisions).toEqual([]);
      expect(result.state.players[playerId].eliminated).toContain(onlyCard);
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("rejects invalid choices atomically", () => {
    const playerId: PlayerId = "witchKing";
    const base = createGame("invalid-forsake");
    const state = enqueuePendingDecision(base, {
      type: "forsake",
      playerId,
      reason: "card effect",
      minimum: 1,
    });

    const result = tryResolveForsakeDecision(state, playerId, [
      { source: "hand", cardId: "missing-card" },
    ]);

    expect(result).toMatchObject({
      ok: false,
      state,
      violation: { code: "invalid-decision-choice" },
    });
  });

  it("blocks normal actions until the oldest decision is resolved", () => {
    const base = createGame("decision-blocks-actions");
    const state = enqueuePendingDecision(base, {
      type: "forsake",
      playerId: "frodo",
      reason: "card effect",
      minimum: 1,
    });

    const result = tryPass(state);

    expect(result).toMatchObject({
      ok: false,
      state,
      violation: { code: "pending-decision-required" },
    });
  });

  it("takes an offered search result into hand and reshuffles the draw deck", () => {
    const playerId: PlayerId = "frodo";
    const base = createGame("resolve-search");
    const selected = base.players[playerId].draw[2];
    expect(selected).toBeDefined();
    if (selected === undefined) {
      return;
    }
    const originalDraw = base.players[playerId].draw;
    const state = enqueuePendingDecision(base, {
      type: "search",
      playerId,
      zones: ["draw"],
      choices: originalDraw.slice(0, 4),
      minimum: 1,
      maximum: 1,
      destination: "hand",
      source: "test:take-from-draw",
    });

    const result = tryResolveSearchDecision(state, playerId, [selected]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players[playerId].hand).toContain(selected);
      expect(result.state.players[playerId].draw).not.toContain(selected);
      expect(result.state.players[playerId].draw).not.toEqual(
        originalDraw.filter((cardId) => cardId !== selected),
      );
      expect(result.state.pendingDecisions).toEqual([]);
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("supports optional searches and alternate destinations", () => {
    const playerId: PlayerId = "aragorn";
    const base = createGame("optional-search");
    const selected = base.players[playerId].cycle[0];
    expect(selected).toBeDefined();
    if (selected === undefined) {
      return;
    }
    const optional = enqueuePendingDecision(base, {
      type: "search",
      playerId,
      zones: ["cycle"],
      choices: [selected],
      minimum: 0,
      maximum: 1,
      destination: "eliminated",
    });

    const skipped = tryResolveSearchDecision(optional, playerId, []);
    const chosen = tryResolveSearchDecision(optional, playerId, [selected]);

    expect(skipped.ok).toBe(true);
    expect(chosen.ok).toBe(true);
    if (chosen.ok) {
      expect(chosen.state.players[playerId].cycle).not.toContain(selected);
      expect(chosen.state.players[playerId].eliminated).toContain(selected);
      expect(assertGameInvariants(chosen.state)).toEqual([]);
    }
  });

  it("rejects unoffered and duplicate search selections atomically", () => {
    const playerId: PlayerId = "saruman";
    const base = createGame("invalid-search");
    const offered = base.players[playerId].draw[0];
    const unoffered = base.players[playerId].draw[1];
    expect(offered).toBeDefined();
    expect(unoffered).toBeDefined();
    if (offered === undefined || unoffered === undefined) {
      return;
    }
    const state = enqueuePendingDecision(base, {
      type: "search",
      playerId,
      zones: ["draw"],
      choices: [offered],
      minimum: 1,
      maximum: 1,
      destination: "hand",
    });

    const result = tryResolveSearchDecision(state, playerId, [unoffered]);

    expect(result).toMatchObject({
      ok: false,
      state,
      violation: { code: "invalid-decision-choice" },
    });
  });

  it("plays a drawn card without an extra cost and cycles the rest", () => {
    const playerId: PlayerId = "frodo";
    const base = createGame("draw-play-cycle");
    const army = ownedCardOfType(base, playerId, "army");
    const rest = ownedCardOtherThan(base, playerId, army);
    expect(army).toBeDefined();
    expect(rest).toBeDefined();
    if (army === undefined || rest === undefined) {
      return;
    }
    const state = enqueuePendingDecision(
      setAvailableCards(base, playerId, { hand: [army, rest] }),
      {
        type: "drawPlayCycleRest",
        playerId,
        drawnCards: [army, rest],
        playableCards: [army],
        maxPlays: 1,
        source: "test:draw-play-cycle",
      },
    );

    const result = tryResolveDrawPlayCycleRestDecision(state, playerId, [
      { cardId: army, destination: "reserve" },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players[playerId].reserve).toContain(army);
      expect(result.state.players[playerId].cycle).toContain(rest);
      expect(result.state.players[playerId].hand).toEqual([]);
      expect(result.state.pendingDecisions).toEqual([]);
      expect(result.state.roundMemory.playedToReserve).toContain(army);
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("allows playing none and cycles every drawn card", () => {
    const playerId: PlayerId = "witchKing";
    const base = createGame("cycle-entire-draw");
    const first = base.players[playerId].hand[0];
    const second = base.players[playerId].hand[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) {
      return;
    }
    const state = enqueuePendingDecision(base, {
      type: "drawPlayCycleRest",
      playerId,
      drawnCards: [first, second],
      playableCards: [],
      maxPlays: 2,
    });

    const result = tryResolveDrawPlayCycleRestDecision(state, playerId, []);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players[playerId].cycle).toEqual(
        expect.arrayContaining([first, second]),
      );
      expect(result.state.players[playerId].hand).not.toContain(first);
      expect(result.state.players[playerId].hand).not.toContain(second);
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("rejects an illegal drawn-card destination without partial cycling", () => {
    const playerId: PlayerId = "saruman";
    const base = createGame("invalid-drawn-destination");
    const army = ownedCardOfType(base, playerId, "army");
    expect(army).toBeDefined();
    if (army === undefined) {
      return;
    }
    const state = enqueuePendingDecision(
      setAvailableCards(base, playerId, { hand: [army] }),
      {
        type: "drawPlayCycleRest",
        playerId,
        drawnCards: [army],
        playableCards: [army],
        maxPlays: 1,
      },
    );

    const result = tryResolveDrawPlayCycleRestDecision(state, playerId, [
      { cardId: army, destination: "path" },
    ]);

    expect(result).toMatchObject({
      ok: false,
      state,
      violation: { code: "invalid-destination" },
    });
  });

  it("resolves a valid defender casualty choice and cycles survivors", () => {
    const playerId: PlayerId = "frodo";
    const base = createGame("combat-loss-choice");
    const defenders = ownedPathDefenders(base, playerId, 2);
    expect(defenders).toHaveLength(2);
    if (defenders.length !== 2 || base.activePath === null) {
      return;
    }
    const [eliminated, survivor] = defenders;
    if (eliminated === undefined || survivor === undefined) {
      return;
    }
    const arranged = placeOnActivePath(base, playerId, defenders);
    const state = enqueuePendingDecision(arranged, {
      type: "combatLosses",
      side: "free",
      locationType: "path",
      locationId: base.activePath.id,
      attackToCancel: 1,
      candidates: defenders,
      source: "test:path-combat",
    });

    const result = tryResolveCombatLossDecision(state, [eliminated]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players[playerId].eliminated).toContain(eliminated);
      expect(result.state.players[playerId].cycle).toContain(survivor);
      expect(result.state.activePath?.cards).toEqual([]);
      expect(result.state.pendingDecisions).toEqual([]);
      expect(assertGameInvariants(result.state)).toEqual([]);
    }
  });

  it("rejects combat losses that cancel too little or eliminate extras", () => {
    const playerId: PlayerId = "frodo";
    const base = createGame("invalid-combat-loss-choice");
    const defenders = ownedPathDefenders(base, playerId, 2);
    expect(defenders).toHaveLength(2);
    if (defenders.length !== 2 || base.activePath === null) {
      return;
    }
    const state = enqueuePendingDecision(
      placeOnActivePath(base, playerId, defenders),
      {
        type: "combatLosses",
        side: "free",
        locationType: "path",
        locationId: base.activePath.id,
        attackToCancel: 1,
        candidates: defenders,
      },
    );

    const tooLittle = tryResolveCombatLossDecision(state, []);
    const tooMany = tryResolveCombatLossDecision(state, defenders);

    expect(tooLittle).toMatchObject({
      ok: false,
      state,
      violation: { code: "invalid-decision-choice" },
    });
    expect(tooMany).toMatchObject({
      ok: false,
      state,
      violation: { code: "invalid-decision-choice" },
    });
  });
});

function moveToReserve(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: player.hand.filter((cardId) => cardId !== instanceId),
        reserve: [...player.reserve, instanceId],
      },
    },
  };
}

function setAvailableCards(
  state: GameState,
  playerId: PlayerId,
  available: {
    readonly draw?: readonly string[];
    readonly hand?: readonly string[];
    readonly cycle?: readonly string[];
    readonly reserve?: readonly string[];
  },
): GameState {
  const player = state.players[playerId];
  const draw = available.draw ?? [];
  const hand = available.hand ?? [];
  const cycle = available.cycle ?? [];
  const reserve = available.reserve ?? [];
  const availableIds = new Set([...draw, ...hand, ...cycle, ...reserve]);
  const ownedCards = [
    ...player.draw,
    ...player.hand,
    ...player.cycle,
    ...player.reserve,
    ...player.eliminated,
  ];
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        draw,
        hand,
        cycle,
        reserve,
        eliminated: ownedCards.filter((cardId) => !availableIds.has(cardId)),
      },
    },
  };
}

function ownedCardOfType(
  state: GameState,
  playerId: PlayerId,
  type: "army" | "character",
): string | undefined {
  return Object.keys(state.cards).find((instanceId) => {
    const card = getCardDefinition(getCard(state, instanceId).cardId);
    return card.owner === playerId && card.type === type;
  });
}

function ownedCardOtherThan(
  state: GameState,
  playerId: PlayerId,
  excluded: string | undefined,
): string | undefined {
  return Object.keys(state.cards).find((instanceId) => {
    const card = getCardDefinition(getCard(state, instanceId).cardId);
    return card.owner === playerId && instanceId !== excluded;
  });
}

function ownedPathDefenders(
  state: GameState,
  playerId: PlayerId,
  count: number,
): readonly string[] {
  return Object.keys(state.cards)
    .filter((instanceId) => {
      const card = getCardDefinition(getCard(state, instanceId).cardId);
      return (
        card.owner === playerId &&
        card.type === "character" &&
        card.pathIcons > 0
      );
    })
    .slice(0, count);
}

function placeOnActivePath(
  state: GameState,
  playerId: PlayerId,
  instanceIds: readonly string[],
): GameState {
  if (state.activePath === null) {
    return state;
  }
  const moved = new Set(instanceIds);
  const player = state.players[playerId];
  return {
    ...state,
    activePath: {
      ...state.activePath,
      cards: [...state.activePath.cards, ...instanceIds],
    },
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        draw: player.draw.filter((cardId) => !moved.has(cardId)),
        hand: player.hand.filter((cardId) => !moved.has(cardId)),
        cycle: player.cycle.filter((cardId) => !moved.has(cardId)),
        eliminated: player.eliminated.filter((cardId) => !moved.has(cardId)),
        reserve: player.reserve.filter((cardId) => !moved.has(cardId)),
      },
    },
  };
}
