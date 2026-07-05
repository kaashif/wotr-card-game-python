import { describe, expect, it } from "vitest";

import {
  battlegroundDefinitions,
  cardDefinitions,
  pathDefinitions,
} from "./data";
import {
  canPlayTo,
  createGame,
  cycleCard,
  getCard,
  getCardDefinition,
  playCard,
  resolveCombat,
  selectPlayer,
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
      expect(player.hand).toHaveLength(5);
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

function mustHave<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected value to exist");
  }
  return value;
}
