import "./styles.css";
import {
  createGame,
  cycleSelected,
  discardOversizedHands,
  nextTurn,
  pass,
  playSelected,
  resolveCombat,
  selectCard,
  selectPlayer,
  useRingToken,
} from "./game";
import { render } from "./render";
import { clearSavedGame, loadGame, saveGame } from "./storage";
import type { GameState, PlayDestination, PlayerId } from "./types";

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) {
  throw new Error("Missing #app root");
}
const appRoot = root;

let state = loadGame() ?? createGame("middle-earth");

function commit(nextState: GameState, shouldSave = true): void {
  state = discardOversizedHands(nextState);
  if (shouldSave) {
    saveGame(state);
  }
  appRoot.innerHTML = render(state);
}

root.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const playerButton = target.closest<HTMLButtonElement>("[data-player]");
  if (playerButton !== null) {
    const playerId = playerButton.dataset["player"];
    if (isPlayerId(playerId)) {
      commit(selectPlayer(state, playerId));
    }
    return;
  }

  const cardButton = target.closest<HTMLButtonElement>("[data-card]");
  if (cardButton !== null) {
    commit(selectCard(state, cardButton.dataset["card"] ?? null));
    return;
  }

  const playButton = target.closest<HTMLButtonElement>("[data-play]");
  if (playButton !== null) {
    const destination = playButton.dataset["play"];
    if (isPlayDestination(destination)) {
      commit(nextTurn(playSelected(state, destination)));
    }
    return;
  }

  const actionButton = target.closest<HTMLButtonElement>("[data-action]");
  if (actionButton === null) {
    return;
  }

  switch (actionButton.dataset["action"]) {
    case "new": {
      const seed = window.prompt("Seed", String(Date.now()));
      if (seed !== null) {
        clearSavedGame();
        commit(createGame(seed));
      }
      break;
    }
    case "save":
      saveGame(state);
      commit(state, false);
      break;
    case "load": {
      const loaded = loadGame();
      if (loaded !== null) {
        commit(loaded, false);
      }
      break;
    }
    case "cycle":
      commit(cycleSelected(state));
      break;
    case "ring":
      commit(useRingToken(state));
      break;
    case "pass":
      commit(pass(state));
      break;
    case "resolve":
      commit(resolveCombat(state));
      break;
    default:
      break;
  }
});

commit(state, false);

function isPlayerId(value: string | undefined): value is PlayerId {
  return (
    value === "frodo" ||
    value === "aragorn" ||
    value === "witchKing" ||
    value === "saruman"
  );
}

function isPlayDestination(value: string | undefined): value is PlayDestination {
  return value === "reserve" || value === "battleground" || value === "path";
}
