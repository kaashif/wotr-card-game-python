import { describe, expect, it } from "vitest";

import { edgeCaseRegistry } from "./edgeCaseRegistry";
import {
  activatePathById,
  addActivePathAttackTokens,
  addActivePathDefenseTokens,
  addCorruption,
  canPlayTo,
  createGame,
  cycleCard,
  eligiblePathsByNumber,
  enqueuePendingDecision,
  nextTurn,
  removeCorruption,
  resolveOldestPendingDecision,
  resolveCombat,
  tryMoveFromReserve,
  tryPass,
  tryPlayCard,
  tryWinnow,
  usePlayerRingToken,
} from "./game";
import { assertGameInvariants } from "./invariants";
import type { CommandResult, GameState, PlayerId } from "./types";

describe("engine invariants", () => {
  it.each(Array.from({ length: 80 }, (_, index) => `invariant-seed-${index + 1}`))(
    "holds after setup for %s",
    (seed) => {
      expect(assertGameInvariants(createGame(seed))).toEqual([]);
    },
  );

  it("records every edge-case registry entry with category, status, and source", () => {
    expect(edgeCaseRegistry.length).toBeGreaterThanOrEqual(20);
    expect(new Set(edgeCaseRegistry.map((entry) => entry.id)).size).toBe(
      edgeCaseRegistry.length,
    );
    expect(edgeCaseRegistry.every((entry) => entry.sources.length > 0)).toBe(true);
    expect(edgeCaseRegistry.some((entry) => entry.status === "blocked")).toBe(true);
    expect(edgeCaseRegistry.some((entry) => entry.status === "implemented")).toBe(true);
    expect(edgeCaseRegistry.some((entry) => entry.category === "bgg")).toBe(true);
  });

  it.each(Array.from({ length: 40 }, (_, index) => `fuzz-seed-${index + 1}`))(
    "preserves invariants through seeded generated commands: %s",
    (seed) => {
      let state = createGame(seed);
      const rng = seededRng(seed);

      for (let step = 0; step < 80; step += 1) {
        const before = JSON.stringify(state);
        const next = applyGeneratedCommand(state, rng);
        expect(assertGameInvariants(next)).toEqual([]);
        if (next === state) {
          expect(JSON.stringify(next)).toBe(before);
        }
        state = next;
      }
    },
  );

  it("tracks corruption without allowing negative corruption", () => {
    const state = createGame("corruption");
    const added = addCorruption(state, 3);
    const removed = removeCorruption(added, 99);

    expect(added.corruption.tokens).toBe(3);
    expect(removed.corruption.tokens).toBe(0);
    expect(removed.score.shadow).toBeGreaterThanOrEqual(0);
    expect(assertGameInvariants(removed)).toEqual([]);
  });

  it("path attack and defense tokens affect path combat scoring", () => {
    const state = createGame("path-tokens");
    const withAttack = addActivePathAttackTokens(state, 2);
    const scoredForShadow = resolveCombat(withAttack);

    const withDefense = addActivePathDefenseTokens(createGame("path-tokens-defense"), 2);
    const scoredWithDefense = resolveCombat(withDefense);

    expect(scoredForShadow.corruption.tokens).toBeGreaterThanOrEqual(
      scoredWithDefense.corruption.tokens,
    );
    expect(assertGameInvariants(scoredForShadow)).toEqual([]);
    expect(assertGameInvariants(scoredWithDefense)).toEqual([]);
  });

  it("activating a replacement path records path history and rejects reuse", () => {
    const state = createGame("activate-path");
    const currentNumber = state.activePath?.id === undefined
      ? 1
      : eligiblePathsByNumber(state, 1).length > 0
        ? 1
        : 2;
    const replacement = eligiblePathsByNumber(state, currentNumber)[0];
    expect(replacement).toBeDefined();
    if (replacement === undefined) {
      return;
    }

    const next = activatePathById(state, replacement);
    expect(next).not.toBeNull();
    if (next !== null) {
      expect(next.activePath?.id).toBe(replacement);
      expect(next.activatedPaths).toContain(replacement);
      expect(activatePathById(next, replacement)).toBeNull();
      expect(assertGameInvariants(next)).toEqual([]);
    }
  });

  it("queues and resolves typed pending decisions without mutating card locations", () => {
    const state = createGame("pending-decision");
    const decision = {
      type: "forsake" as const,
      playerId: "frodo" as const,
      reason: "test decision",
      minimum: 1,
      source: "invariant-test",
    };

    const queued = enqueuePendingDecision(state, decision);
    const resolved = resolveOldestPendingDecision(queued);

    expect(queued.pendingDecisions).toEqual([decision]);
    expect(queued.eventLog.at(-1)?.type).toBe("pendingDecisionCreated");
    expect(resolved.pendingDecisions).toEqual([]);
    expect(assertGameInvariants(queued)).toEqual([]);
    expect(assertGameInvariants(resolved)).toEqual([]);
  });
});

function applyGeneratedCommand(state: GameState, rng: () => number): GameState {
  const playerId = state.activePlayer;
  const player = state.players[playerId];
  const roll = rng();

  if (roll < 0.18) {
    return acceptOrKeep(state, tryPass(state));
  }

  if (roll < 0.36) {
    const card = choose(player.hand, rng);
    if (card === null) {
      return state;
    }
    return cycleCard(state, playerId, card);
  }

  if (roll < 0.55) {
    const playable = player.hand.find((card) => canPlayTo(state, playerId, card, "reserve"));
    if (playable === undefined) {
      return state;
    }
    const afterPlay = acceptOrKeep(state, tryPlayCard(state, playerId, playable, "reserve"));
    return afterPlay === state ? state : nextTurn(afterPlay);
  }

  if (roll < 0.7) {
    const first = player.hand[0];
    const second = player.hand[1];
    if (first === undefined || second === undefined) {
      return state;
    }
    const afterWinnow = acceptOrKeep(state, tryWinnow(state, playerId, first, second));
    return afterWinnow === state ? state : nextTurn(afterWinnow);
  }

  if (roll < 0.82) {
    const movable = player.reserve.find((card) => {
      return (
        !state.roundMemory.playedToReserve.includes(card) &&
        (tryMoveFromReserve(state, playerId, card, "path").ok ||
          tryMoveFromReserve(state, playerId, card, "battleground").ok)
      );
    });
    if (movable === undefined) {
      return state;
    }
    const destination = tryMoveFromReserve(state, playerId, movable, "path").ok
      ? "path"
      : "battleground";
    const afterMove = acceptOrKeep(
      state,
      tryMoveFromReserve(state, playerId, movable, destination),
    );
    return afterMove === state ? state : nextTurn(afterMove);
  }

  if (roll < 0.92) {
    return usePlayerRingToken(state, playerId);
  }

  const illegalPlayer = nextPlayer(playerId);
  const illegalCard = state.players[illegalPlayer].hand[0] ?? "missing-card";
  const result = tryPlayCard(state, illegalPlayer, illegalCard, "reserve");
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result.state)).toBe(JSON.stringify(state));
  return state;
}

function acceptOrKeep(state: GameState, result: CommandResult): GameState {
  if (!result.ok) {
    expect(JSON.stringify(result.state)).toBe(JSON.stringify(state));
    return state;
  }
  return result.state;
}

function choose<T>(items: readonly T[], rng: () => number): T | null {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(rng() * items.length)] ?? null;
}

function nextPlayer(playerId: PlayerId): PlayerId {
  switch (playerId) {
    case "frodo":
      return "witchKing";
    case "witchKing":
      return "aragorn";
    case "aragorn":
      return "saruman";
    case "saruman":
      return "frodo";
  }
}

function seededRng(seed: string): () => number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    let value = (hash += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
