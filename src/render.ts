import { players, turnOrder } from "./data";
import {
  canPlayTo,
  getBattlegroundDefinition,
  getCard,
  getCardDefinition,
  getPathDefinition,
  phaseLabel,
} from "./game";
import type { GameState, PlayDestination, PlayerId } from "./types";

export function render(state: GameState): string {
  const selectedPlayer = state.players[state.selection.playerId];
  const selectedCard =
    state.selection.cardId === null ? null : getCard(state, state.selection.cardId);
  const selectedDefinition =
    selectedCard === null ? null : getCardDefinition(selectedCard.cardId);

  return `
    <main class="shell">
      <section class="topbar">
        <div class="brand">
          <img src="${import.meta.env.BASE_URL}wotr.svg" alt="" />
          <div>
            <h1>War of the Ring Card Game</h1>
            <p>Round ${state.round} - ${phaseLabel(state.phase)} - Seed ${esc(state.seed)}</p>
          </div>
        </div>
        <div class="scoreboard" aria-label="Score">
          <div>
            <span>Free Peoples</span>
            <strong>${state.score.free}</strong>
          </div>
          <div>
            <span>Shadow</span>
            <strong>${state.score.shadow}</strong>
          </div>
        </div>
        <div class="toolbar">
          <button type="button" data-action="new">New</button>
          <button type="button" data-action="save">Save</button>
          <button type="button" data-action="load">Load</button>
        </div>
      </section>

      <section class="board">
        <aside class="players" aria-label="Players">
          ${turnOrder.map((playerId) => playerButton(state, playerId)).join("")}
        </aside>

        <section class="table" aria-label="Table">
          ${activeBattleground(state)}
          ${activePath(state)}
        </section>

        <aside class="commands" aria-label="Actions">
          <h2>${esc(players[selectedPlayer.id].name)}</h2>
          <p class="muted">${selectedDefinition === null ? "No card selected" : esc(selectedDefinition.title)}</p>
          <div class="command-grid">
            ${commandButton(state, "reserve", "Play Reserve")}
            ${commandButton(state, "battleground", "Play Battle")}
            ${commandButton(state, "path", "Play Path")}
            <button type="button" data-action="cycle">Cycle</button>
            <button type="button" data-action="ring">Ring Token</button>
            <button type="button" data-action="pass">Pass</button>
            <button type="button" data-action="resolve">Resolve</button>
          </div>
        </aside>
      </section>

      <section class="hand-row">
        <div class="zone hand">
          <div class="zone-head">
            <h2>Hand</h2>
            <span>${selectedPlayer.hand.length}</span>
          </div>
          <div class="card-grid">
            ${selectedPlayer.hand.map((instanceId) => cardView(state, instanceId)).join("")}
          </div>
        </div>

        <div class="zone">
          <div class="zone-head">
            <h2>Reserve</h2>
            <span>${selectedPlayer.reserve.length}</span>
          </div>
          <div class="mini-list">
            ${selectedPlayer.reserve.map((instanceId) => compactCard(state, instanceId)).join("")}
          </div>
        </div>

        <div class="zone">
          <div class="zone-head">
            <h2>Piles</h2>
          </div>
          <dl class="pile-list">
            <div><dt>Draw</dt><dd>${selectedPlayer.draw.length}</dd></div>
            <div><dt>Cycle</dt><dd>${selectedPlayer.cycle.length}</dd></div>
            <div><dt>Eliminated</dt><dd>${selectedPlayer.eliminated.length}</dd></div>
            <div><dt>Ring</dt><dd>${selectedPlayer.usedRingToken ? "Used" : "Ready"}</dd></div>
          </dl>
        </div>

        <div class="zone log">
          <div class="zone-head">
            <h2>Log</h2>
          </div>
          <ol>
            ${state.log
              .slice()
              .reverse()
              .map((entry) => `<li>${esc(entry.message)}</li>`)
              .join("")}
          </ol>
        </div>
      </section>
    </main>
  `;
}

function playerButton(state: GameState, playerId: PlayerId): string {
  const player = state.players[playerId];
  const selected = state.selection.playerId === playerId ? "true" : "false";
  const active = state.activePlayer === playerId ? " active" : "";
  return `
    <button class="player-button${active}" type="button" data-player="${playerId}" aria-pressed="${selected}">
      <span>${esc(players[playerId].name)}</span>
      <small>${players[playerId].side === "free" ? "Free Peoples" : "Shadow"}</small>
      <b>${player.hand.length}</b>
    </button>
  `;
}

function activeBattleground(state: GameState): string {
  const active = state.activeBattleground;
  if (active === null) {
    return `<article class="site empty"><h2>No battleground</h2></article>`;
  }
  const definition = getBattlegroundDefinition(active.id);
  if (definition === undefined) {
    return `<article class="site empty"><h2>Unknown battleground</h2></article>`;
  }
  return `
    <article class="site battleground">
      <header>
        <span>Battleground</span>
        <h2>${esc(definition.title)}</h2>
      </header>
      <p>${esc(definition.text)}</p>
      <div class="metrics">
        <span>Defense ${definition.defenseIcons}</span>
        <span>VP ${definition.victoryPoints}</span>
      </div>
      <div class="mini-list">
        ${active.cards.map((instanceId) => compactCard(state, instanceId)).join("")}
      </div>
    </article>
  `;
}

function activePath(state: GameState): string {
  const active = state.activePath;
  if (active === null) {
    return `<article class="site empty"><h2>No path</h2></article>`;
  }
  const definition = getPathDefinition(active.id);
  if (definition === undefined) {
    return `<article class="site empty"><h2>Unknown path</h2></article>`;
  }
  return `
    <article class="site path">
      <header>
        <span>Path ${definition.pathNumber}</span>
        <h2>${esc(definition.title)}</h2>
      </header>
      <p>${esc(definition.text)}</p>
      <div class="metrics">
        <span>Defense ${definition.defenseIcons}</span>
        <span>VP ${definition.victoryPoints}</span>
      </div>
      <div class="mini-list">
        ${active.cards.map((instanceId) => compactCard(state, instanceId)).join("")}
      </div>
    </article>
  `;
}

function cardView(state: GameState, instanceId: string): string {
  const instance = getCard(state, instanceId);
  const card = getCardDefinition(instance.cardId);
  const selected = state.selection.cardId === instanceId ? " selected" : "";
  return `
    <button class="card${selected}" type="button" data-card="${instanceId}">
      <span class="faction">${esc(card.faction)}</span>
      <strong>${esc(card.title)}</strong>
      <small>${esc(card.type)}</small>
      <p>${esc(card.text)}</p>
      <span class="icons">
        <b>A${card.battlegroundAttack}</b>
        <b>D${card.battlegroundDefense}</b>
        <b>P${card.pathIcons}</b>
      </span>
    </button>
  `;
}

function compactCard(state: GameState, instanceId: string): string {
  const instance = getCard(state, instanceId);
  const card = getCardDefinition(instance.cardId);
  return `<span class="compact-card">${esc(card.title)} <small>${esc(card.faction)}</small></span>`;
}

function commandButton(
  state: GameState,
  destination: PlayDestination,
  label: string,
): string {
  const selected = state.selection.cardId;
  const disabled =
    selected === null ||
    !canPlayTo(state, state.selection.playerId, selected, destination);
  return `<button type="button" data-play="${destination}" ${disabled ? "disabled" : ""}>${label}</button>`;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
