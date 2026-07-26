import { describe, expect, it } from "vitest";

import {
  appendCommand,
  applyGameCommand,
  createPublicArchive,
  createGameArchive,
  currentArchiveMetadata,
  hashGameState,
  journalEventVersion,
  replayArchive,
  replayArchiveFromCheckpoint,
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

  it("rejects an unsupported journal event version", () => {
    const initial = createGame("archive-event-version");
    const card = mustHave(initial.players.frodo.hand[0]);
    const archive = createGameArchive("archive-event-version", [
      { action: "cycle", player: "frodo", card },
    ]);
    const [event] = archive.events;
    expect(event).toBeDefined();
    if (event === undefined) {
      return;
    }
    const changedVersion = {
      ...archive,
      events: [
        {
          ...event,
          eventVersion: journalEventVersion + 1,
        },
      ],
    } as unknown as GameArchive;

    expect(replayArchive(changedVersion).errors).toContainEqual(
      expect.stringContaining("version mismatch"),
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

  it("creates viewer-specific archives without opponent private card identities", () => {
    const initial = createGame("archive-public-view");
    const secret = mustHave(initial.players.saruman.hand[0]);
    const archive = createGameArchive("archive-public-view", [
      { action: "cycle", player: "saruman", card: secret },
    ]);

    const opponentArchive = createPublicArchive(archive, "frodo");
    const ownerArchive = createPublicArchive(archive, "saruman");

    expect(opponentArchive.events[0]?.command).toEqual({
      action: "cycle",
      player: "saruman",
    });
    expect(JSON.stringify(opponentArchive)).not.toContain(secret);
    expect(JSON.stringify(ownerArchive)).toContain(secret);
  });

  it("replays from a verified checkpoint to the same final state as a full replay", () => {
    const seed = "archive-checkpoint";
    const initial = createGame(seed);
    const cycled = mustHave(initial.players.frodo.hand[0]);
    const commands: readonly GameCommand[] = [
      { action: "ring", player: "aragorn" },
      { action: "cycle", player: "frodo", card: cycled },
      { action: "selectPlayer", player: "saruman" },
      { action: "ring", player: "saruman" },
    ];
    const archive = createGameArchive(seed, commands);
    const checkpointEventCount = 2;
    const checkpoint = commands
      .slice(0, checkpointEventCount)
      .reduce(applyGameCommand, initial);

    const fullReplay = replayArchive(archive);
    const checkpointReplay = replayArchiveFromCheckpoint(
      archive,
      checkpointEventCount,
      checkpoint,
    );

    expect(checkpointReplay.errors).toEqual([]);
    expect(hashGameState(checkpointReplay.finalState)).toBe(
      hashGameState(fullReplay.finalState),
    );
    expect(checkpointReplay.finalState).toEqual(fullReplay.finalState);
  });

  it("matches state built incrementally while commands are archived", () => {
    const seed = "archive-incremental";
    const initial = createGame(seed);
    const card = mustHave(initial.players.frodo.hand[0]);
    const commands: readonly GameCommand[] = [
      { action: "cycle", player: "frodo", card },
      { action: "ring", player: "witchKing" },
      { action: "selectPlayer", player: "aragorn" },
    ];
    let archive = createGameArchive(seed);
    let incremental = initial;
    for (const command of commands) {
      archive = appendCommand(archive, command);
      incremental = applyGameCommand(incremental, command);
      expect(archive.finalStateHash).toBe(hashGameState(incremental));
    }

    const replay = replayArchive(archive);

    expect(replay.errors).toEqual([]);
    expect(replay.finalState).toEqual(incremental);
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
