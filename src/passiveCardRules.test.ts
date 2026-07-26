import { describe, expect, it } from "vitest";

import {
  canPass,
  createGame,
  drawCountForPlayer,
  forsakeCard,
  getCard,
  getCardDefinition,
} from "./game";
import { assertGameInvariants } from "./invariants";
import type { GameState, PlayerId } from "./types";

describe("passive card rules", () => {
  it("raises carryover for each matching in-play card", () => {
    const playerId: PlayerId = "aragorn";
    const base = createGame("carryover-modifier");
    const modifier = ownedCardMatching(
      base,
      playerId,
      "increase your carryover limit by 1",
    );
    expect(modifier).toBeDefined();
    if (modifier === undefined) {
      return;
    }
    const threeCards = ownedCards(base, playerId)
      .filter((instanceId) => instanceId !== modifier)
      .slice(0, 3);
    expect(threeCards).toHaveLength(3);
    const state = setPlayerZones(base, playerId, {
      hand: threeCards,
      reserve: [modifier],
    });

    expect(canPass({ ...state, activePlayer: playerId }, playerId)).toBe(true);
    expect(assertGameInvariants(state)).toEqual([]);
  });

  it("adds reserve draw bonuses to the normal player draw count", () => {
    const playerId: PlayerId = "witchKing";
    const base = createGame("reserve-draw-modifier");
    const modifier = ownedCardMatching(
      base,
      playerId,
      "while in reserve draw +1",
    );
    expect(modifier).toBeDefined();
    if (modifier === undefined) {
      return;
    }
    const state = setPlayerZones(base, playerId, { reserve: [modifier] });

    expect(drawCountForPlayer(state, playerId)).toBe(
      drawCountForPlayer(setPlayerZones(base, playerId, {}), playerId) + 1,
    );
    expect(assertGameInvariants(state)).toEqual([]);
  });

  it("cycles top-deck replacement cards instead of eliminating them", () => {
    const playerId: PlayerId = "aragorn";
    const base = createGame("top-deck-forsake-replacement");
    const replacement = ownedCardMatching(
      base,
      playerId,
      "forsaken from top of the draw deck",
    );
    expect(replacement).toBeDefined();
    if (replacement === undefined) {
      return;
    }
    const state = setPlayerZones(base, playerId, {
      draw: [replacement],
      cycle: [],
    });

    const next = forsakeCard(state, playerId, "draw");

    expect(next).not.toBeNull();
    expect(next?.players[playerId].cycle).toContain(replacement);
    expect(next?.players[playerId].eliminated).not.toContain(replacement);
    if (next !== null) {
      expect(assertGameInvariants(next)).toEqual([]);
    }
  });
});

function ownedCardMatching(
  state: GameState,
  playerId: PlayerId,
  text: string,
): string | undefined {
  const normalized = normalizeText(text);
  return ownedCards(state, playerId).find((instanceId) => {
    const definition = getCardDefinition(getCard(state, instanceId).cardId);
    return normalizeText(definition.text).includes(normalized);
  });
}

function normalizeText(text: string): string {
  return text.toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim();
}

function ownedCards(state: GameState, playerId: PlayerId): readonly string[] {
  const player = state.players[playerId];
  return [
    ...player.draw,
    ...player.hand,
    ...player.cycle,
    ...player.eliminated,
    ...player.reserve,
  ];
}

function setPlayerZones(
  state: GameState,
  playerId: PlayerId,
  overrides: {
    readonly draw?: readonly string[];
    readonly hand?: readonly string[];
    readonly cycle?: readonly string[];
    readonly reserve?: readonly string[];
  },
): GameState {
  const player = state.players[playerId];
  const draw = overrides.draw ?? [];
  const hand = overrides.hand ?? [];
  const cycle = overrides.cycle ?? [];
  const reserve = overrides.reserve ?? [];
  const placed = new Set([...draw, ...hand, ...cycle, ...reserve]);
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
        eliminated: ownedCards(state, playerId).filter(
          (instanceId) => !placed.has(instanceId),
        ),
      },
    },
  };
}
