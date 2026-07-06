import type { GameState } from "./types";

const storageKey = "wotr-card-game-state";

export function saveGame(state: GameState): void {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isGameState(parsed)) {
      return normalizeGameState(parsed);
    }
  } catch {
    return null;
  }

  return null;
}

export function clearSavedGame(): void {
  localStorage.removeItem(storageKey);
}

function isGameState(value: unknown): value is GameState {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === 1 &&
    "players" in value &&
    "cards" in value
  );
}

function normalizeGameState(state: GameState): GameState {
  return {
    ...state,
    attachments: state.attachments ?? {},
    roundMemory: state.roundMemory ?? {
      playedToReserve: [],
      playedCharacterOrItemCards: [],
    },
  };
}
