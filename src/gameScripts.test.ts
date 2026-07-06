import { describe, expect, it } from "vitest";

import {
  battlegroundDefinitions,
  cardDefinitions,
  pathDefinitions,
  turnOrder,
} from "./data";
import { canPlayTo, createGame, getCardDefinition, validateState } from "./game";
import {
  arrangeGame,
  exportGameScript,
  renderReplay,
  resolveCardRef,
  runGameScript,
} from "./gameScripts";
import type { CardDefinition, Faction, GameState, PlayerId, PlayDestination } from "./types";

const seedCases = Array.from({ length: 180 }, (_, index) => `mass-seed-${index + 1}`);
const ringReplayCases = seedCases.flatMap((seed) =>
  turnOrder.map((player) => ({ name: `${seed}:${player}:ring`, seed, player })),
);
const cycleReplayCases = seedCases.flatMap((seed) =>
  turnOrder.map((player) => ({ name: `${seed}:${player}:cycle`, seed, player })),
);
const combatReplayCases = seedCases.map((seed) => ({ name: `${seed}:combat`, seed }));

const legalityCases = cardDefinitions.flatMap((card) =>
  (["reserve", "path", "battleground"] satisfies readonly PlayDestination[]).map(
    (destination) => ({
      name: `${card.owner}:${card.id}:${destination}`,
      card,
      destination,
    }),
  ),
);

const reservePlayCases = cardDefinitions
  .filter((card) => card.type !== "event")
  .map((card) => ({ name: `${card.owner}:${card.id}:reserve-play`, card }));

const lastCardCases = cardDefinitions
  .filter((card) => card.type !== "event")
  .map((card) => ({ name: `${card.owner}:${card.id}:last-card`, card }));

const generatedCaseCount =
  ringReplayCases.length +
  cycleReplayCases.length +
  combatReplayCases.length +
  legalityCases.length +
  reservePlayCases.length +
  lastCardCases.length;

describe("compact game scripts", () => {
  it("defines at least 1000 generated engine cases", () => {
    expect(generatedCaseCount).toBeGreaterThanOrEqual(1000);
  });

  it("exports and renders a compact replay", () => {
    const result = runGameScript({
      name: "example replay",
      seed: "example-replay",
      arrange: {
        players: {
          aragorn: {
            hand: ["anduril-46", "strider-44"],
          },
        },
      },
      steps: [
        { action: "selectPlayer", player: "aragorn" },
        { action: "play", player: "aragorn", card: "anduril-46", destination: "reserve" },
      ],
    });

    expect(result.frames).toHaveLength(3);
    expect(result.frames.every((frame) => frame.errors.length === 0)).toBe(true);
    expect(renderReplay(result)).toContain("aragorn play anduril-46 to reserve");
    expect(exportGameScript(result.script)).toContain('"seed": "example-replay"');
  });

  it.each(ringReplayCases)("replays ring-token draw: $name", ({ seed, player }) => {
    const result = runGameScript({
      seed,
      steps: [{ action: "ring", player }],
    });

    expect(result.frames.every((frame) => frame.errors.length === 0)).toBe(true);
    expect(result.finalState.players[player].usedRingToken).toBe(true);
    expect(result.finalState.log.at(-1)?.message).toContain("used a ring token");
  });

  it.each(cycleReplayCases)("replays cycling from hand: $name", ({ seed, player }) => {
    const initial = createGame(seed);
    const card = mustHave(initial.players[player].hand[0]);
    const result = runGameScript({
      seed,
      steps: [{ action: "cycle", player, card }],
    });

    expect(result.frames.every((frame) => frame.errors.length === 0)).toBe(true);
    expect(result.finalState.players[player].hand).not.toContain(card);
    expect(result.finalState.players[player].cycle).toContain(card);
  });

  it.each(combatReplayCases)("keeps combat replay state valid: $name", ({ seed }) => {
    const initial = createGame(seed);
    const pathPlay = firstPlayable(initial, "frodo", "path");
    const battlegroundPlay = firstPlayable(initial, "saruman", "battleground");
    const steps = [
      ...(pathPlay === null
        ? []
        : [{ action: "play" as const, player: "frodo" as const, card: pathPlay, destination: "path" as const }]),
      ...(battlegroundPlay === null
        ? []
        : [
            {
              action: "play" as const,
              player: "saruman" as const,
              card: battlegroundPlay,
              destination: "battleground" as const,
            },
          ]),
      { action: "resolveCombat" as const },
    ];
    const result = runGameScript({ seed, steps });

    expect(result.frames.every((frame) => frame.errors.length === 0)).toBe(true);
    expect(result.finalState.round).toBe(2);
    expect(result.finalState.currentPathNumber).toBe(2);
  });

  it.each(legalityCases)("checks destination legality: $name", ({ card, destination }) => {
    const state = arrangeForCard(card);
    const instanceId = resolveCardRef(state, card.owner, card.id);

    expect(canPlayTo(state, card.owner, instanceId, destination)).toBe(
      expectedLegality(state, card, destination),
    );
  });

  it.each(reservePlayCases)("replays reserve play and payment: $name", ({ card }) => {
    const cost = costCardFor(card);
    const state = arrangeGame(createGame(`reserve-${card.id}`), {
      players: {
        [card.owner]: {
          hand: [card.id, cost.id],
          draw: [],
          cycle: [],
        },
      },
    });
    const result = runGameScript({
      seed: `reserve-${card.id}`,
      arrange: {
        players: {
          [card.owner]: {
            hand: [card.id, cost.id],
            draw: [],
            cycle: [],
          },
        },
      },
      steps: [
        {
          action: "play",
          player: card.owner,
          card: card.id,
          destination: "reserve",
          cost: cost.id,
        },
      ],
    });
    const played = resolveCardRef(state, card.owner, card.id);
    const paid = resolveCardRef(state, card.owner, cost.id);

    expect(result.finalState.players[card.owner].reserve).toContain(played);
    expect(result.finalState.players[card.owner].cycle).toContain(paid);
    expect(result.frames.every((frame) => frame.errors.length === 0)).toBe(true);
  });

  it.each(lastCardCases)("replays last-card forsake fallback: $name", ({ card }) => {
    const forsaken = costCardFor(card);
    const state = arrangeGame(createGame(`last-${card.id}`), {
      players: {
        [card.owner]: {
          hand: [card.id],
          draw: [forsaken.id],
          cycle: [],
        },
      },
    });
    const result = runGameScript({
      seed: `last-${card.id}`,
      arrange: {
        players: {
          [card.owner]: {
            hand: [card.id],
            draw: [forsaken.id],
            cycle: [],
          },
        },
      },
      steps: [{ action: "play", player: card.owner, card: card.id, destination: "reserve" }],
    });
    const played = resolveCardRef(state, card.owner, card.id);
    const eliminated = resolveCardRef(state, card.owner, forsaken.id);

    expect(result.finalState.players[card.owner].reserve).toContain(played);
    expect(result.finalState.players[card.owner].eliminated).toContain(eliminated);
    expect(result.frames.every((frame) => frame.errors.length === 0)).toBe(true);
  });
});

function arrangeForCard(card: CardDefinition): GameState {
  const cost = costCardFor(card);
  const activePath = pathDefinitions.find((path) =>
    card.allowedPaths.includes(path.pathNumber),
  ) ?? pathDefinitions[0];
  const activeBattleground =
    battlegroundDefinitions.find((battleground) => {
      return battlegroundFactions(battleground).includes(card.faction);
    }) ?? battlegroundDefinitions[0];

  return arrangeGame(createGame(`legality-${card.id}`), {
    activePath: { id: activePath.id },
    activeBattleground: { id: activeBattleground.id },
    players: {
      [card.owner]: {
        hand: [card.id, cost.id],
        draw: [],
        cycle: [],
      },
    },
  });
}

function expectedLegality(
  state: GameState,
  card: CardDefinition,
  destination: PlayDestination,
): boolean {
  if (destination === "reserve") {
    return card.type !== "event";
  }
  if (destination === "path") {
    const path = pathDefinitions.find((candidate) => candidate.id === state.activePath?.id);
    return (
      path !== undefined &&
      card.type === "character" &&
      card.allowedPaths.includes(path.pathNumber)
    );
  }
  const battleground = battlegroundDefinitions.find(
    (candidate) => candidate.id === state.activeBattleground?.id,
  );
  return (
    battleground !== undefined &&
    card.type !== "event" &&
    card.type !== "item" &&
    battlegroundFactions(battleground).includes(card.faction)
  );
}

function battlegroundFactions(
  battleground: (typeof battlegroundDefinitions)[number],
): readonly Faction[] {
  return [...battleground.attackingFactions, ...battleground.defendingFactions];
}

function firstPlayable(
  state: GameState,
  player: PlayerId,
  destination: "battleground" | "path",
): string | null {
  return (
    state.players[player].hand.find((instanceId) =>
      canPlayTo(state, player, instanceId, destination),
    ) ?? null
  );
}

function costCardFor(card: CardDefinition): CardDefinition {
  const cost = cardDefinitions.find((candidate) => {
    return candidate.owner === card.owner && candidate.id !== card.id;
  });
  if (cost === undefined) {
    throw new Error(`No cost card available for ${card.id}`);
  }
  return cost;
}

function mustHave<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected value to exist");
  }
  return value;
}
