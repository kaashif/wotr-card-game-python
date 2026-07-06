import { battlegroundDefinitions, cardDefinitions, pathDefinitions } from "./data";
import {
  createGame,
  attachItem,
  cycleCard,
  discardOversizedHands,
  forsakeCard,
  moveFromReserve,
  pass,
  playCard,
  resolveCombat,
  selectCard,
  selectPlayer,
  winnow,
  usePlayerRingToken,
  validateState,
} from "./game";
import type { ForsakeSource, GameState, PlayerId, PlayDestination } from "./types";

export const archiveVersion = 1;
export const engineVersion = "engine-command-journal-v3";
export const rulesReferenceVersion = "rules-v1.1-cards-v0.2";
export const rngVersion = "fnv1a-seed-mulberry32-v1";

export type GameCommand =
  | {
      readonly action: "attach";
      readonly player: PlayerId;
      readonly item: string;
      readonly wielder: string;
      readonly cost?: string;
    }
  | { readonly action: "cycle"; readonly player: PlayerId; readonly card: string }
  | { readonly action: "discardOversizedHands" }
  | {
      readonly action: "forsake";
      readonly player: PlayerId;
      readonly source: ForsakeSource;
      readonly card?: string;
    }
  | {
      readonly action: "move";
      readonly player: PlayerId;
      readonly card: string;
      readonly destination: Exclude<PlayDestination, "reserve">;
    }
  | { readonly action: "pass" }
  | {
      readonly action: "play";
      readonly player: PlayerId;
      readonly card: string;
      readonly destination: PlayDestination;
      readonly cost?: string;
    }
  | { readonly action: "resolveCombat" }
  | { readonly action: "ring"; readonly player: PlayerId }
  | { readonly action: "selectCard"; readonly card: string | null }
  | { readonly action: "selectPlayer"; readonly player: PlayerId };

export interface GameArchiveMetadata {
  readonly archiveVersion: typeof archiveVersion;
  readonly engineVersion: typeof engineVersion;
  readonly rulesReferenceVersion: typeof rulesReferenceVersion;
  readonly rngVersion: typeof rngVersion;
  readonly referenceDataHash: string;
}

export interface JournalEvent {
  readonly index: number;
  readonly command: GameCommand;
  readonly beforeStateHash: string;
  readonly afterStateHash: string;
  readonly validationErrors: readonly string[];
}

export interface GameArchive {
  readonly metadata: GameArchiveMetadata;
  readonly seed: string;
  readonly initialStateHash: string;
  readonly events: readonly JournalEvent[];
  readonly finalStateHash: string;
}

export interface ReplayVerification {
  readonly archive: GameArchive;
  readonly finalState: GameState;
  readonly errors: readonly string[];
}

export function currentArchiveMetadata(): GameArchiveMetadata {
  return {
    archiveVersion,
    engineVersion,
    rulesReferenceVersion,
    rngVersion,
    referenceDataHash: hashReferenceData(),
  };
}

export function createGameArchive(seed: string, commands: readonly GameCommand[] = []): GameArchive {
  return appendCommands(emptyArchive(seed), commands);
}

export function emptyArchive(seed: string): GameArchive {
  const initialState = createGame(seed);
  const initialStateHash = hashGameState(initialState);
  return {
    metadata: currentArchiveMetadata(),
    seed,
    initialStateHash,
    events: [],
    finalStateHash: initialStateHash,
  };
}

export function appendCommands(
  archive: GameArchive,
  commands: readonly GameCommand[],
): GameArchive {
  return commands.reduce((nextArchive, command) => appendCommand(nextArchive, command), archive);
}

export function appendCommand(archive: GameArchive, command: GameCommand): GameArchive {
  const verification = replayArchive(archive);
  if (verification.errors.length > 0) {
    throw new Error(`Cannot append to invalid archive: ${verification.errors.join("; ")}`);
  }
  const nextState = applyGameCommand(verification.finalState, command);
  const validationErrors = validateState(nextState);
  const event: JournalEvent = {
    index: archive.events.length + 1,
    command,
    beforeStateHash: hashGameState(verification.finalState),
    afterStateHash: hashGameState(nextState),
    validationErrors,
  };
  return {
    ...archive,
    events: [...archive.events, event],
    finalStateHash: event.afterStateHash,
  };
}

export function replayArchive(archive: GameArchive): ReplayVerification {
  const errors: string[] = [];
  const expectedMetadata = currentArchiveMetadata();
  if (!metadataMatches(archive.metadata, expectedMetadata)) {
    errors.push("Archive metadata does not match the current engine/reference data.");
  }

  let state = createGame(archive.seed);
  const initialStateHash = hashGameState(state);
  if (archive.initialStateHash !== initialStateHash) {
    errors.push(
      `Initial state hash mismatch: expected ${archive.initialStateHash}, got ${initialStateHash}.`,
    );
  }

  for (const event of archive.events) {
    const beforeStateHash = hashGameState(state);
    if (event.beforeStateHash !== beforeStateHash) {
      errors.push(
        `Event ${event.index} before-state hash mismatch: expected ${event.beforeStateHash}, got ${beforeStateHash}.`,
      );
    }

    state = applyGameCommand(state, event.command);
    const afterStateHash = hashGameState(state);
    if (event.afterStateHash !== afterStateHash) {
      errors.push(
        `Event ${event.index} after-state hash mismatch: expected ${event.afterStateHash}, got ${afterStateHash}.`,
      );
    }

    const validationErrors = validateState(state);
    if (!arraysEqual(event.validationErrors, validationErrors)) {
      errors.push(`Event ${event.index} validation errors changed.`);
    }
  }

  const finalStateHash = hashGameState(state);
  if (archive.finalStateHash !== finalStateHash) {
    errors.push(
      `Final state hash mismatch: expected ${archive.finalStateHash}, got ${finalStateHash}.`,
    );
  }

  return { archive, finalState: state, errors };
}

export function applyGameCommand(state: GameState, command: GameCommand): GameState {
  switch (command.action) {
    case "attach":
      return attachItem(
        state,
        command.player,
        command.item,
        command.wielder,
        command.cost,
      );
    case "cycle":
      return cycleCard(state, command.player, command.card);
    case "discardOversizedHands":
      return discardOversizedHands(state);
    case "forsake":
      return forsakeCard(state, command.player, command.source, command.card) ?? state;
    case "move":
      return moveFromReserve(state, command.player, command.card, command.destination);
    case "pass":
      return pass(state);
    case "play":
      return playCard(
        state,
        command.player,
        command.card,
        command.destination,
        command.cost,
      );
    case "resolveCombat":
      return resolveCombat(state);
    case "ring":
      return usePlayerRingToken(state, command.player);
    case "selectCard":
      return selectCard(state, command.card);
    case "selectPlayer":
      return selectPlayer(state, command.player);
  }
}

export function hashGameState(state: GameState): string {
  return stableHash(state);
}

export function hashReferenceData(): string {
  return stableHash({
    battlegroundDefinitions,
    cardDefinitions,
    pathDefinitions,
    rulesReferenceVersion,
  });
}

export function stableHash(value: unknown): string {
  return fnv1a32(stableStringify(value)).toString(16).padStart(8, "0");
}

function metadataMatches(left: GameArchiveMetadata, right: GameArchiveMetadata): boolean {
  return (
    left.archiveVersion === right.archiveVersion &&
    left.engineVersion === right.engineVersion &&
    left.rulesReferenceVersion === right.rulesReferenceVersion &&
    left.rngVersion === right.rngVersion &&
    left.referenceDataHash === right.referenceDataHash
  );
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableStringify(value));
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortForStableStringify(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortForStableStringify(nested)]),
    );
  }
  return value;
}

function fnv1a32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
