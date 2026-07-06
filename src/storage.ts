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
    activatedPaths: state.activatedPaths ?? [],
    activePath:
      state.activePath === null
        ? null
        : {
            ...state.activePath,
            attackTokens: state.activePath.attackTokens ?? 0,
            defenseTokens: state.activePath.defenseTokens ?? 0,
          },
    attachments: state.attachments ?? {},
    roundMemory: state.roundMemory ?? {
      playedToReserve: [],
      playedCharacterOrItemCards: [],
    },
    pendingDecisions: state.pendingDecisions ?? [],
    eventLog: state.eventLog ?? [],
    scoringAreas: state.scoringAreas ?? {
      battlegrounds: { free: [], shadow: [] },
      paths: { free: [], shadow: [] },
    },
    corruption: state.corruption ?? { tokens: 0 },
  };
}
