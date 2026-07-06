import { describe, expect, it } from "vitest";

import {
  appendCommand,
  createGameArchive,
  currentArchiveMetadata,
  hashGameState,
  replayArchive,
} from "./archive";
import { createGame } from "./game";
import type { GameArchive, GameCommand } from "./archive";

describe("game archives", () => {
  it("records a deterministic command journal with state hashes", () => {
    const initial = createGame("archive-basic");
    const firstCard = mustHave(initial.players.frodo.hand[0]);
    const secondCard = mustHave(initial.players.frodo.hand[1]);
    const commands: readonly GameCommand[] = [
      { action: "selectPlayer", player: "frodo" },
      { action: "play", player: "frodo", card: firstCard, destination: "reserve", cost: secondCard },
      { action: "ring", player: "aragorn" },
    ];

    const archive = createGameArchive("archive-basic", commands);
    const replay = replayArchive(archive);

    expect(replay.errors).toEqual([]);
    expect(archive.metadata).toEqual(currentArchiveMetadata());
    expect(archive.events).toHaveLength(commands.length);
    expect(archive.initialStateHash).toBe(hashGameState(initial));
    expect(archive.finalStateHash).toBe(hashGameState(replay.finalState));
    expect(replay.finalState.players.frodo.reserve).toContain(firstCard);
    expect(replay.finalState.players.frodo.cycle).toContain(secondCard);
    expect(replay.finalState.players.aragorn.usedRingToken).toBe(true);
  });

  it("detects a changed command in an archived event", () => {
    const initial = createGame("archive-tamper");
    const card = mustHave(initial.players.frodo.hand[0]);
    const archive = createGameArchive("archive-tamper", [
      { action: "cycle", player: "frodo", card },
    ]);
    const tampered = replaceFirstCommand(archive, {
      action: "ring",
      player: "frodo",
    });

    expect(replayArchive(tampered).errors).toContainEqual(
      expect.stringContaining("after-state hash mismatch"),
    );
  });

  it("detects metadata drift before trusting old replay results", () => {
    const archive = createGameArchive("archive-metadata");
    const changedMetadata: GameArchive = {
      ...archive,
      metadata: {
        ...archive.metadata,
        referenceDataHash: "changed-reference-data",
      },
    };

    expect(replayArchive(changedMetadata).errors).toContain(
      "Archive metadata does not match the current engine/reference data.",
    );
  });

  it("refuses to append commands to an archive whose hashes no longer verify", () => {
    const initial = createGame("archive-append");
    const card = mustHave(initial.players.frodo.hand[0]);
    const archive = createGameArchive("archive-append", [
      { action: "cycle", player: "frodo", card },
    ]);
    const corrupted: GameArchive = {
      ...archive,
      finalStateHash: "bad-final-state-hash",
    };

    expect(() => appendCommand(corrupted, { action: "ring", player: "frodo" })).toThrow(
      /Cannot append to invalid archive/,
    );
  });
});

function replaceFirstCommand(archive: GameArchive, command: GameCommand): GameArchive {
  const [firstEvent, ...remainingEvents] = archive.events;
  if (firstEvent === undefined) {
    throw new Error("Expected at least one event");
  }
  return {
    ...archive,
    events: [{ ...firstEvent, command }, ...remainingEvents],
  };
}

function mustHave<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected value to exist");
  }
  return value;
}
