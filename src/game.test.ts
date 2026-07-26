import { describe, expect, it } from "vitest";

import {
  battlegroundDefinitions,
  cardDefinitions,
  pathDefinitions,
} from "./data";
import {
  canPlayTo,
  attachItem,
  createGame,
  cycleCard,
  getCard,
  getCardDefinition,
  playCard,
  resolveCombat,
  selectPlayer,
  tryMoveFromReserve,
  tryPass,
  tryPlayCard,
  tryWinnow,
  tryForsake,
  usePlayerRingToken,
  validateState,
} from "./game";
import type { GameState, PlayerId } from "./types";

describe("game engine", () => {
  it("loads cards and locations from the repository reference files", () => {
    expect(pathDefinitions).toHaveLength(27);
    expect(battlegroundDefinitions).toHaveLength(14);
    expect(cardDefinitions).toHaveLength(124);
    expect(cardDefinitions.every((card) => card.sourceLine > 0)).toBe(true);
    expect(pathDefinitions.every((path) => path.sourceLine > 0)).toBe(true);
    expect(
      battlegroundDefinitions.every((battleground) => battleground.sourceLine > 0),
    ).toBe(true);
  });

  it("creates deterministic initial state from a seed", () => {
    const first = createGame("same-seed");
    const second = createGame("same-seed");

    expect(first).toEqual(second);
    expect(validateState(first)).toEqual([]);
    expect(first.phase).toBe("action");
    expect(first.activeBattleground).not.toBeNull();
    expect(first.activePath).not.toBeNull();
  });

  it("keeps all cards in exactly one zone after setup", () => {
    const state = createGame("zones");

    expect(validateState(state)).toEqual([]);
    for (const player of Object.values(state.players)) {
      expect(player.hand.length).toBeGreaterThanOrEqual(5);
      expect(player.cycle).toHaveLength(2);
    }
  });

  it("selects a player without mutating engine-owned card zones", () => {
    const state = createGame("selection");
    const selected = selectPlayer(state, "saruman");

    expect(selected.selection.playerId).toBe("saruman");
    expect(validateState(selected)).toEqual([]);
    expect(totalCards(selected)).toBe(totalCards(state));
  });

  it("cycles a hand card into the player's cycle pile", () => {
    const state = createGame("cycle");
    const playerId: PlayerId = "frodo";
    const card = mustHave(state.players[playerId].hand[0]);
    const next = cycleCard(state, playerId, card);

    expect(next.players[playerId].hand).not.toContain(card);
    expect(next.players[playerId].cycle).toContain(card);
    expect(validateState(next)).toEqual([]);
  });

  it("uses a ring token once and draws two cards", () => {
    const state = createGame("ring");
    const playerId: PlayerId = "aragorn";
    const before = state.players[playerId];
    const next = usePlayerRingToken(state, playerId);
    const after = next.players[playerId];

    expect(after.usedRingToken).toBe(true);
    expect(after.hand.length).toBe(before.hand.length + 2);
    expect(after.draw.length + after.cycle.length).toBe(
      before.draw.length + before.cycle.length - 2,
    );
    expect(validateState(next)).toEqual([]);

    const repeated = usePlayerRingToken(next, playerId);
    expect(repeated.players[playerId].usedRingToken).toBe(true);
    expect(repeated.players[playerId].hand.length).toBe(after.hand.length);
  });

  it("plays a legal card to reserve and cycles the play cost", () => {
    const state = createGame("reserve");
    const playerId: PlayerId = "frodo";
    const card = mustHave(state.players[playerId].hand[0]);
    const next = playCard(state, playerId, card, "reserve");

    expect(next.players[playerId].reserve).toContain(card);
    expect(next.players[playerId].hand).not.toContain(card);
    expect(next.players[playerId].hand).toHaveLength(
      state.players[playerId].hand.length - 2,
    );
    expect(next.players[playerId].cycle).toHaveLength(
      state.players[playerId].cycle.length + 1,
    );
    expect(validateState(next)).toEqual([]);
  });

  it("attaches item cards to an indicated wielder already in play", () => {
    const playerId: PlayerId = "aragorn";
    const item = "aragorn-anduril-46-1";
    const cost = "aragorn-strider-44-1";
    const wielder = "aragorn-aragorn-38-1";
    const state = setPlayerZones(createGame("attach-item"), playerId, {
      hand: [item, cost],
      reserve: [wielder],
    });

    expect(canPlayTo(state, playerId, item, "reserve")).toBe(false);
    expect(canPlayTo(state, playerId, item, "path")).toBe(false);
    expect(canPlayTo(state, playerId, item, "battleground")).toBe(false);

    const next = attachItem(state, playerId, item, wielder, cost);

    expect(next.attachments[wielder]).toContain(item);
    expect(next.players[playerId].reserve).not.toContain(item);
    expect(next.players[playerId].cycle).toContain(cost);
    expect(validateState(next)).toEqual([]);
  });

  it("forsakes from the draw deck when playing the only hand card", () => {
    const playerId: PlayerId = "aragorn";
    const played = "aragorn-boromir-39-1";
    const forsaken = "aragorn-faramir-41-1";
    const state = setPlayerZones(createGame("last-card-draw-cost"), playerId, {
      draw: [forsaken],
      hand: [played],
      cycle: [],
    });

    const next = playCard(state, playerId, played, "reserve");

    expect(next.players[playerId].reserve).toContain(played);
    expect(next.players[playerId].eliminated).toContain(forsaken);
    expect(validateState(next)).toEqual([]);
  });

  it("can play the final hand card when no draw or cycle card can pay the cost", () => {
    const playerId: PlayerId = "frodo";
    const played = "frodo-bilbo-baggins-73-1";
    const state = setPlayerZones(createGame("absolute-last-card"), playerId, {
      draw: [],
      hand: [played],
      cycle: [],
    });

    const next = playCard(state, playerId, played, "reserve");

    expect(next.players[playerId].reserve).toContain(played);
    expect(next.players[playerId].hand).toHaveLength(0);
    expect(next.players[playerId].draw).toHaveLength(0);
    expect(next.players[playerId].cycle).toHaveLength(0);
    expect(validateState(next)).toEqual([]);
  });

  it("rejects illegal battleground plays without mutating zones", () => {
    const state = createGame("illegal-battle");
    const playerId: PlayerId = "frodo";
    const illegalCard =
      state.players[playerId].hand.find((instanceId) => {
        return !canPlayTo(state, playerId, instanceId, "battleground");
      }) ?? state.players[playerId].hand[0];

    const next = playCard(state, playerId, mustHave(illegalCard), "battleground");

    expect(next.players[playerId]).toEqual(state.players[playerId]);
    expect(totalCards(next)).toBe(totalCards(state));
    expect(validateState(next)).toEqual([]);
  });

  it("resolves a path and battleground combat round", () => {
    let state = createGame("combat");
    const pathCard = findPlayable(state, "frodo", "path");
    if (pathCard !== null) {
      state = playCard(state, "frodo", pathCard, "path");
    }

    const battleCard = findPlayable(state, "saruman", "battleground");
    if (battleCard !== null) {
      state = playCard(state, "saruman", battleCard, "battleground");
    }

    const next = resolveCombat(state);

    expect(next.round).toBe(2);
    expect(next.currentPathNumber).toBe(2);
    expect(next.score.free + next.score.shadow).toBeGreaterThan(0);
    expect(next.activePath?.id).not.toBe(state.activePath?.id);
    expect(validateState(next)).toEqual([]);
  });

  it("can be serialized and reloaded without losing validity", () => {
    const state = createGame("serialize");
    const reloaded = JSON.parse(JSON.stringify(state)) as GameState;

    expect(reloaded).toEqual(state);
    expect(validateState(reloaded)).toEqual([]);
  });

  it("card definitions remain available for every live card", () => {
    const state = createGame("definitions");
    for (const instanceId of Object.keys(state.cards)) {
      const card = getCard(state, instanceId);
      const definition = getCardDefinition(card.cardId);
      expect(definition.id).toBe(card.cardId);
      expect(definition.title.length).toBeGreaterThan(0);
    }
  });

  it("rejects passing above carryover when enemy hands are not larger", () => {
    const state = {
      ...createGame("pass-legality"),
      activePlayer: "frodo" as const,
      pendingDecisions: [],
    };

    const result = tryPass(state);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violation.code).toBe("pass-not-allowed");
    }
  });

  it("moves reserve cards only after the round they entered reserve", () => {
    const playerId: PlayerId = "frodo";
    const card = "frodo-frodo-baggins-69-1";
    const freshReserve = {
      ...setPlayerZones(createGame("fresh-reserve-move"), playerId, {
        reserve: [card],
      }),
      activePlayer: playerId,
      pendingDecisions: [],
      roundMemory: { playedToReserve: [card], playedCharacterOrItemCards: [] },
    };

    const rejectedMove = tryMoveFromReserve(freshReserve, playerId, card, "path");

    expect(rejectedMove.ok).toBe(false);
    if (!rejectedMove.ok) {
      expect(rejectedMove.violation.code).toBe("reserve-card-played-this-round");
    }

    const laterReserve = {
      ...freshReserve,
      roundMemory: { playedToReserve: [], playedCharacterOrItemCards: [] },
    };
    const moved = tryMoveFromReserve(laterReserve, playerId, card, "path");

    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect(moved.state.activePath?.cards).toContain(card);
      expect(moved.state.players[playerId].reserve).not.toContain(card);
      expect(validateState(moved.state)).toEqual([]);
    }
  });

  it("blocks Mouth of Sauron and Lidless Eye from paths while a Shadow battleground is active", () => {
    const playerId: PlayerId = "witchKing";
    const mouth = "witchKing-mouth-of-sauron-154-1";
    const eye = "witchKing-the-lidless-eye-156-1";
    const base = setPlayerZones(createGame("shadow-path-restrictions"), playerId, {
      hand: [mouth, eye],
      reserve: [],
    });
    const shadowBattleground = {
      ...base,
      activeBattleground: {
        id: "moria",
        cards: [],
        attackTokens: 0,
        defenseTokens: 0,
      },
      additionalActiveBattlegrounds: [],
      activePath: {
        id: "orodruin",
        cards: [],
        attackTokens: 0,
        defenseTokens: 0,
      },
    };

    expect(canPlayTo(shadowBattleground, playerId, mouth, "path")).toBe(false);
    expect(canPlayTo(shadowBattleground, playerId, eye, "path")).toBe(false);

    const freeBattleground = {
      ...shadowBattleground,
      activeBattleground: {
        ...shadowBattleground.activeBattleground,
        id: "helms-deep",
      },
    };

    expect(canPlayTo(freeBattleground, playerId, mouth, "path")).toBe(true);
    expect(canPlayTo(freeBattleground, playerId, eye, "path")).toBe(true);
  });

  it("applies typed when-played draw effects", () => {
    const aragornState = {
      ...setPlayerZones(createGame("boromir-when-played"), "aragorn", {
        hand: ["aragorn-boromir-39-1", "aragorn-denethor-40-1"],
        draw: ["aragorn-faramir-41-1"],
        cycle: [],
      }),
      activePlayer: "aragorn" as const,
      pendingDecisions: [],
    };

    const boromir = tryPlayCard(
      aragornState,
      "aragorn",
      "aragorn-boromir-39-1",
      "reserve",
      "aragorn-denethor-40-1",
    );

    expect(boromir.ok).toBe(true);
    if (boromir.ok) {
      expect(boromir.state.players.aragorn.hand).toContain(
        "aragorn-faramir-41-1",
      );
      expect(boromir.events).toContainEqual({
        type: "cardsDrawn",
        playerId: "aragorn",
        count: 1,
      });
      expect(validateState(boromir.state)).toEqual([]);
    }

    const shadowBase = createGame("lidless-eye-when-played");
    const shadowState = {
      ...setPlayerZones(shadowBase, "witchKing", {
        hand: [
          "witchKing-the-lidless-eye-156-1",
          "witchKing-trolls-of-udun-137-1",
        ],
        draw: ["witchKing-mouth-of-sauron-154-1"],
        cycle: [],
      }),
      activePlayer: "witchKing" as const,
      pendingDecisions: [],
    };
    const sarumanHand = shadowState.players.saruman.hand.length;

    const eye = tryPlayCard(
      shadowState,
      "witchKing",
      "witchKing-the-lidless-eye-156-1",
      "reserve",
      "witchKing-trolls-of-udun-137-1",
    );

    expect(eye.ok).toBe(true);
    if (eye.ok) {
      expect(eye.state.players.witchKing.hand).toContain(
        "witchKing-mouth-of-sauron-154-1",
      );
      expect(eye.state.players.saruman.hand).toHaveLength(
        sarumanHand + 1,
      );
      expect(eye.events).toEqual(
        expect.arrayContaining([
          {
            type: "cardsDrawn",
            playerId: "witchKing",
            count: 1,
          },
          {
            type: "cardsDrawn",
            playerId: "saruman",
            count: 1,
          },
        ]),
      );
      expect(validateState(eye.state)).toEqual([]);
    }
  });

  it("queues Boromir's mandatory forsake after playing him to a path", () => {
    const state = {
      ...setPlayerZones(createGame("boromir-path-forsake"), "aragorn", {
        hand: ["aragorn-boromir-39-1", "aragorn-denethor-40-1"],
        draw: ["aragorn-faramir-41-1"],
        cycle: [],
      }),
      activePlayer: "aragorn" as const,
      pendingDecisions: [],
      activePath: {
        id: "imladris-rivendel",
        cards: [],
        attackTokens: 0,
        defenseTokens: 0,
      },
    };

    const result = tryPlayCard(
      state,
      "aragorn",
      "aragorn-boromir-39-1",
      "path",
      "aragorn-denethor-40-1",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.pendingDecisions[0]).toMatchObject({
        type: "forsake",
        playerId: "aragorn",
        minimum: 1,
        source: "card:boromir-39",
      });
      expect(validateState(result.state)).toEqual([]);
    }
  });

  it.each([
    {
      name: "Balrog",
      card: "saruman-balrog-118-1",
      path: "caradhras",
    },
    {
      name: "Shelob",
      card: "saruman-shelob-123-1",
      path: "orodruin",
    },
  ])("queues both Free Peoples forsakes when $name moves", ({ card, path }) => {
    const state = {
      ...setPlayerZones(createGame(`move-${card}`), "saruman", {
        reserve: [card],
      }),
      activePlayer: "saruman" as const,
      pendingDecisions: [],
      roundMemory: {
        playedToReserve: [],
        playedCharacterOrItemCards: [],
      },
      activePath: {
        id: path,
        cards: [],
        attackTokens: 0,
        defenseTokens: 0,
      },
    };

    const result = tryMoveFromReserve(
      state,
      "saruman",
      card,
      "path",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.pendingDecisions).toMatchObject([
        { type: "forsake", playerId: "frodo", minimum: 1 },
        { type: "forsake", playerId: "aragorn", minimum: 1 },
      ]);
      expect(validateState(result.state)).toEqual([]);
    }
  });

  it("winnows two hand cards, honoring elimination replacements, and draws one", () => {
    const playerId: PlayerId = "frodo";
    const first = "frodo-frodo-baggins-69-1";
    const second = "frodo-sam-gamgee-72-1";
    const drawn = "frodo-bilbo-baggins-73-1";
    const state = {
      ...setPlayerZones(createGame("winnow"), playerId, {
        hand: [first, second],
        draw: [drawn],
        cycle: [],
      }),
      activePlayer: playerId,
      pendingDecisions: [],
    };

    const result = tryWinnow(state, playerId, first, second);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players[playerId].cycle).toContain(first);
      expect(result.state.players[playerId].eliminated).toContain(second);
      expect(result.state.players[playerId].eliminated).not.toContain(first);
      expect(result.state.players[playerId].hand).toContain(drawn);
      expect(validateState(result.state)).toEqual([]);
    }
  });

  it("forsakes a chosen hand or reserve card instead of always taking draw", () => {
    const playerId: PlayerId = "aragorn";
    const hand = "aragorn-boromir-39-1";
    const reserve = "aragorn-faramir-41-1";
    const draw = "aragorn-strider-44-1";
    const state = setPlayerZones(createGame("forsake-choice"), playerId, {
      hand: [hand],
      reserve: [reserve],
      draw: [draw],
    });

    const handResult = tryForsake(state, playerId, "hand", hand);
    const reserveResult = tryForsake(state, playerId, "reserve", reserve);
    const drawResult = tryForsake(state, playerId, "draw");

    expect(handResult.ok).toBe(true);
    expect(reserveResult.ok).toBe(true);
    expect(drawResult.ok).toBe(true);
    if (handResult.ok && reserveResult.ok && drawResult.ok) {
      expect(handResult.state.players[playerId].eliminated).toContain(hand);
      expect(reserveResult.state.players[playerId].eliminated).toContain(reserve);
      expect(drawResult.state.players[playerId].eliminated).toContain(draw);
    }
  });
});

function findPlayable(
  state: GameState,
  playerId: PlayerId,
  destination: "battleground" | "path",
): string | null {
  return (
    state.players[playerId].hand.find((instanceId) =>
      canPlayTo(state, playerId, instanceId, destination),
    ) ?? null
  );
}

function totalCards(state: GameState): number {
  return Object.keys(state.cards).length;
}

function setPlayerZones(
  state: GameState,
  playerId: PlayerId,
  zones: Partial<
    Pick<GameState["players"][PlayerId], "draw" | "hand" | "cycle" | "eliminated" | "reserve">
  >,
): GameState {
  const targetPlayer = state.players[playerId];
  const explicitCards = new Set(Object.values(zones).flat());
  const keptEliminated = targetPlayer.eliminated.filter(
    (instanceId) => !explicitCards.has(instanceId),
  );
  const sweptCards = [
    ...targetPlayer.draw,
    ...targetPlayer.hand,
    ...targetPlayer.cycle,
    ...targetPlayer.reserve,
  ].filter((instanceId) => !explicitCards.has(instanceId));

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...targetPlayer,
        draw: zones.draw ?? [],
        hand: zones.hand ?? [],
        cycle: zones.cycle ?? [],
        reserve: zones.reserve ?? [],
        eliminated: zones.eliminated ?? [...keptEliminated, ...sweptCards],
      },
    },
  };
}

function mustHave<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected value to exist");
  }
  return value;
}
