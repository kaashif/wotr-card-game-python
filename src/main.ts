import "./styles.css";
import { players, turnOrder } from "./data";
import {
  canMoveTo,
  canPlayTo,
  createGame,
  cycleSelected,
  discardOversizedHands,
  getBattlegroundDefinition,
  getCard,
  getCardDefinition,
  getPathDefinition,
  moveFromReserve,
  nextTurn,
  pass,
  phaseLabel,
  playSelected,
  resolveCombat,
  selectCard,
  selectPlayer,
  useRingToken,
} from "./game";
import { clearSavedGame, loadGame, saveGame } from "./storage";
import type {
  CardDefinition,
  CardType,
  GameState,
  PlayDestination,
  PlayerId,
  Side,
} from "./types";

type Seat = "north" | "east" | "south" | "west";
type CardContext = "hand" | "table";
type RealCardView = {
  readonly instanceId: string;
  readonly ownerId: PlayerId;
  readonly definition: CardDefinition;
};

const playerSeats: Readonly<Record<PlayerId, Seat>> = {
  frodo: "south",
  witchKing: "west",
  aragorn: "north",
  saruman: "east",
};

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) {
  throw new Error("Missing #app root");
}

const appRoot = root;
let state = loadGame() ?? createGame("middle-earth");
let combatPulse = 0;
let zoomTimer: number | null = null;
let zoomPreview: HTMLElement | null = null;

appRoot.addEventListener("pointerover", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const cardButton = target.closest<HTMLButtonElement>("[data-card-id]");
  if (cardButton === null) {
    return;
  }
  if (
    event.relatedTarget instanceof Node &&
    cardButton.contains(event.relatedTarget)
  ) {
    return;
  }

  clearZoomTimer();
  const instanceId = cardButton.dataset["cardId"] ?? null;
  zoomTimer = window.setTimeout(() => {
    showZoomPreview(instanceId);
  }, 650);
});

appRoot.addEventListener("pointerout", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const cardButton = target.closest<HTMLButtonElement>("[data-card-id]");
  if (cardButton === null) {
    return;
  }
  if (
    event.relatedTarget instanceof Node &&
    cardButton.contains(event.relatedTarget)
  ) {
    return;
  }

  clearZoomTimer();
  hideZoomPreview();
});

appRoot.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const playerButton = target.closest<HTMLButtonElement>("[data-player-id]");
  if (playerButton !== null) {
    const playerId = playerButton.dataset["playerId"];
    if (isPlayerId(playerId)) {
      commit(selectPlayer(state, playerId));
    }
    return;
  }

  const cardButton = target.closest<HTMLButtonElement>("[data-card-id]");
  if (cardButton !== null) {
    const instanceId = cardButton.dataset["cardId"] ?? null;
    const ownerId = instanceId === null ? null : ownerForCard(state, instanceId);
    let nextState = ownerId === null ? state : selectPlayer(state, ownerId);
    nextState = selectCard(nextState, instanceId);
    hideZoomPreview();
    commit(nextState, false);
    return;
  }

  const actionButton = target.closest<HTMLButtonElement>("[data-action]");
  if (actionButton === null) {
    return;
  }

  runAction(actionButton.dataset["action"] ?? "");
});

render();

function runAction(action: string): void {
  switch (action) {
    case "new": {
      const seed = window.prompt("Seed", state.seed);
      if (seed !== null) {
        clearSavedGame();
        combatPulse = 0;
        commit(createGame(seed));
      }
      return;
    }
    case "play":
      commit(playOrMoveSelected());
      return;
    case "reserve":
      commit(playReserveSelected());
      return;
    case "cycle":
      commit(cycleSelected(state));
      return;
    case "ring":
      commit(useRingToken(state));
      return;
    case "pass":
      commit(pass(state));
      return;
    case "resolve":
      combatPulse += 1;
      commit(resolveCombat(state));
      return;
    default:
      return;
  }
}

function playOrMoveSelected(): GameState {
  const instanceId = state.selection.cardId;
  const playerId = state.selection.playerId;
  if (instanceId === null) {
    return state;
  }
  const player = state.players[playerId];
  if (player.reserve.includes(instanceId)) {
    const destination = bestMoveDestination(state, playerId, instanceId);
    return destination === null
      ? state
      : nextTurn(moveFromReserve(state, playerId, instanceId, destination));
  }
  const destination = bestPlayDestination(state, playerId, instanceId);
  return destination === null
    ? state
    : nextTurn(playSelected(state, destination));
}

function playReserveSelected(): GameState {
  const instanceId = state.selection.cardId;
  const playerId = state.selection.playerId;
  if (
    instanceId === null ||
    !state.players[playerId].hand.includes(instanceId) ||
    !canPlayTo(state, playerId, instanceId, "reserve")
  ) {
    return state;
  }
  return nextTurn(playSelected(state, "reserve"));
}

function commit(nextState: GameState, shouldSave = true): void {
  state = discardOversizedHands(nextState);
  if (shouldSave) {
    saveGame(state);
  }
  render();
}

function render(): void {
  const selected = selectedCard();
  appRoot.innerHTML = `
    <main class="game-shell" aria-label="War of the Ring table">
      <header class="hud">
        <section class="identity" aria-label="Game">
          <span class="sigil" aria-hidden="true">W</span>
          <div>
            <h1>War of the Ring</h1>
            <p>Round ${state.round} - ${phaseLabel(state.phase)} - seed ${escapeHtml(state.seed)}</p>
          </div>
        </section>
        <section class="score-track" aria-label="Score">
          <div><span>Free Peoples</span><strong>${state.score.free}</strong></div>
          <div><span>Shadow</span><strong>${state.score.shadow}</strong></div>
          <div><span>Burden</span><strong>${state.corruption.tokens}</strong></div>
        </section>
        <nav class="actions" aria-label="Game actions">
          <button type="button" data-action="new">New</button>
          <button type="button" data-action="play" ${canPlayOrMoveSelected() ? "" : "disabled"}>Play</button>
          <button type="button" data-action="reserve" ${canReserveSelected() ? "" : "disabled"}>Reserve</button>
          <button type="button" data-action="cycle" ${canCycleSelected() ? "" : "disabled"}>Cycle</button>
          <button type="button" data-action="ring">Ring</button>
          <button type="button" data-action="pass">Pass</button>
          <button type="button" data-action="resolve">Resolve</button>
        </nav>
      </header>

      <section class="table-layout">
        <section class="table-stage" aria-label="Four player table">
          ${turnOrder.map((playerId) => playerSeat(playerId)).join("")}
          <section class="felt-table ${combatPulse % 2 === 0 ? "" : "pulse"}" aria-label="Play area">
            <div class="table-rim" aria-hidden="true"></div>
            ${battlegroundZone()}
            ${pathZone()}
            <div class="table-piles" aria-label="Shared piles">
              ${pile("Free battlegrounds", state.battlegroundDecks.free.length, "free")}
              ${pile("Shadow battlegrounds", state.battlegroundDecks.shadow.length, "shadow")}
              ${pile("Path deck", state.pathDeck.length, "path")}
            </div>
          </section>
        </section>

        <aside class="event-log" aria-label="Event log">
          <div class="panel-head">
            <span>Event Log</span>
            <strong>${state.log.length}</strong>
          </div>
          <ol>
            ${state.log
              .slice()
              .reverse()
              .map((entry) => `<li>${escapeHtml(entry.message)}</li>`)
              .join("")}
          </ol>
          <section class="selection">
            <span>Selected</span>
            ${selected === null ? `<p class="empty-selection">No card selected</p>` : cardInspector(selected)}
          </section>
        </aside>
      </section>
    </main>
  `;
}

function playerSeat(playerId: PlayerId): string {
  const player = state.players[playerId];
  const definition = players[playerId];
  const active = state.activePlayer === playerId ? " active" : "";
  const handCards = player.hand.map((instanceId) => cardViewModel(instanceId));
  const reserveCards = player.reserve.map((instanceId) => cardViewModel(instanceId));
  return `
    <section class="seat seat-${playerSeats[playerId]}${active}" aria-label="${escapeHtml(definition.name)} seat">
      <button class="player-chip" type="button" data-player-id="${playerId}">
        <span>${escapeHtml(definition.name)}</span>
        <small>${definition.side === "free" ? "Free Peoples" : "Shadow"} - ${player.hand.length} cards</small>
      </button>
      <div class="hand-fan" style="--cards: ${handCards.length}">
        ${handCards.map((card, index) => cardView(card, "hand", index)).join("")}
      </div>
      ${
        reserveCards.length === 0
          ? ""
          : `<div class="reserve-strip" aria-label="${escapeHtml(definition.name)} reserve">${reserveCards
              .map((card, index) => cardView(card, "table", index))
              .join("")}</div>`
      }
      <div class="personal-piles" aria-label="${escapeHtml(definition.name)} piles">
        ${pile("Draw", player.draw.length, definition.side)}
        ${pile("Cycle", player.cycle.length, "neutral")}
        ${pile("Eliminated", player.eliminated.length, "spent")}
      </div>
    </section>
  `;
}

function battlegroundZone(): string {
  const active = state.activeBattleground;
  if (active === null) {
    return `
      <div class="center-zone battleground-zone">
        <div class="zone-title">
          <span>Battleground</span>
          <strong>No battleground</strong>
          <small>Waiting for round setup</small>
        </div>
        <div class="lane"></div>
      </div>
    `;
  }
  const definition = getBattlegroundDefinition(active.id);
  const title = definition?.title ?? "Unknown battleground";
  const defense = definition?.defenseIcons ?? active.defenseTokens;
  const victoryPoints = definition?.victoryPoints ?? 0;
  const text = definition?.text ?? "No location text.";
  return `
    <div class="center-zone battleground-zone">
      <div class="zone-title">
        <span>Battleground</span>
        <strong>${escapeHtml(title)}</strong>
        <small>Defense ${defense} - VP ${victoryPoints}</small>
        <p>${escapeHtml(text || "No location text.")}</p>
      </div>
      <div class="lane">
        ${active.cards.map((instanceId) => cardView(cardViewModel(instanceId), "table")).join("")}
      </div>
    </div>
  `;
}

function pathZone(): string {
  const active = state.activePath;
  if (active === null) {
    return `
      <div class="center-zone path-zone">
        <div class="zone-title">
          <span>Path</span>
          <strong>No path</strong>
          <small>Waiting for round setup</small>
        </div>
        <div class="lane"></div>
      </div>
    `;
  }
  const definition = getPathDefinition(active.id);
  const title = definition?.title ?? "Unknown path";
  const pathNumber = definition?.pathNumber ?? state.currentPathNumber;
  const victoryPoints = definition?.victoryPoints ?? 0;
  const text = definition?.text ?? "No path text.";
  return `
    <div class="center-zone path-zone">
      <div class="zone-title">
        <span>Path</span>
        <strong>${escapeHtml(title)}</strong>
        <small>Path ${pathNumber} - VP ${victoryPoints} - Attack ${active.attackTokens} / Defense ${active.defenseTokens}</small>
        <p>${escapeHtml(text || "No path text.")}</p>
      </div>
      <div class="lane">
        ${active.cards.map((instanceId) => cardView(cardViewModel(instanceId), "table")).join("")}
      </div>
    </div>
  `;
}

function cardView(card: RealCardView, context: CardContext, index = 0): string {
  const selected = card.instanceId === state.selection.cardId ? " selected" : "";
  const strength = strengthText(card.definition);
  const art = artKey(card.definition);
  return `
    <button
      class="game-card ${context}${selected}"
      type="button"
      data-card-id="${card.instanceId}"
      style="--i: ${index}; --tone: ${toneFor(card.definition.title)}"
      aria-pressed="${card.instanceId === state.selection.cardId ? "true" : "false"}"
    >
      <span class="card-kind">${escapeHtml(card.definition.type)}</span>
      <strong>${escapeHtml(card.definition.title)}</strong>
      <span class="card-art art-${art}" aria-hidden="true">
        <i></i><b></b><em></em>
      </span>
      <span class="card-meta">
        <small>${escapeHtml(card.definition.faction)}</small>
        <mark>${escapeHtml(strength)}</mark>
      </span>
      <p>${escapeHtml(card.definition.text || "No rules text.")}</p>
    </button>
  `;
}

function cardInspector(card: RealCardView): string {
  return `
    <article class="inspector-card">
      <div class="mini-art art-${artKey(card.definition)}" aria-hidden="true"><i></i><b></b><em></em></div>
      <div>
        <strong>${escapeHtml(card.definition.title)}</strong>
        <p>${escapeHtml(card.definition.faction)} ${escapeHtml(card.definition.type)} - ${escapeHtml(card.definition.text || "No rules text.")}</p>
      </div>
    </article>
  `;
}

function zoomCard(card: RealCardView): string {
  return `
    <aside class="zoom-preview" aria-live="polite" aria-label="Card preview">
      <article class="zoom-card" style="--tone: ${toneFor(card.definition.title)}">
        <span class="card-kind">${escapeHtml(card.definition.type)}</span>
        <strong>${escapeHtml(card.definition.title)}</strong>
        <span class="card-art art-${artKey(card.definition)}" aria-hidden="true">
          <i></i><b></b><em></em>
        </span>
        <span class="card-meta">
          <small>${escapeHtml(card.definition.faction)}</small>
          <mark>${escapeHtml(strengthText(card.definition))}</mark>
        </span>
        <p>${escapeHtml(card.definition.text || "No rules text.")}</p>
      </article>
    </aside>
  `;
}

function pile(label: string, count: number, tone: string): string {
  return `
    <div class="pile pile-${tone}">
      <span class="stack" aria-hidden="true"></span>
      <span>${escapeHtml(label)}</span>
      <strong>${count}</strong>
    </div>
  `;
}

function selectedCard(): RealCardView | null {
  const selected = state.selection.cardId;
  return selected === null ? null : cardViewModel(selected);
}

function cardViewModel(instanceId: string): RealCardView {
  const instance = getCard(state, instanceId);
  return {
    instanceId,
    ownerId: ownerForCard(state, instanceId) ?? getCardDefinition(instance.cardId).owner,
    definition: getCardDefinition(instance.cardId),
  };
}

function showZoomPreview(instanceId: string | null): void {
  const card = instanceId === null ? selectedCard() : cardViewModel(instanceId);
  if (card === null) {
    return;
  }
  hideZoomPreview();
  const container = document.createElement("div");
  container.innerHTML = zoomCard(card).trim();
  const preview = container.firstElementChild;
  if (preview instanceof HTMLElement) {
    document.body.append(preview);
    zoomPreview = preview;
  }
}

function hideZoomPreview(): void {
  zoomPreview?.remove();
  zoomPreview = null;
}

function clearZoomTimer(): void {
  if (zoomTimer !== null) {
    window.clearTimeout(zoomTimer);
    zoomTimer = null;
  }
}

function canPlayOrMoveSelected(): boolean {
  const instanceId = state.selection.cardId;
  const playerId = state.selection.playerId;
  if (instanceId === null) {
    return false;
  }
  if (state.players[playerId].reserve.includes(instanceId)) {
    return bestMoveDestination(state, playerId, instanceId) !== null;
  }
  return bestPlayDestination(state, playerId, instanceId) !== null;
}

function canReserveSelected(): boolean {
  const instanceId = state.selection.cardId;
  const playerId = state.selection.playerId;
  return (
    instanceId !== null &&
    state.players[playerId].hand.includes(instanceId) &&
    canPlayTo(state, playerId, instanceId, "reserve")
  );
}

function canCycleSelected(): boolean {
  const instanceId = state.selection.cardId;
  return instanceId !== null && state.players[state.selection.playerId].hand.includes(instanceId);
}

function bestPlayDestination(
  gameState: GameState,
  playerId: PlayerId,
  instanceId: string,
): PlayDestination | null {
  if (canPlayTo(gameState, playerId, instanceId, "battleground")) {
    return "battleground";
  }
  if (canPlayTo(gameState, playerId, instanceId, "path")) {
    return "path";
  }
  if (canPlayTo(gameState, playerId, instanceId, "reserve")) {
    return "reserve";
  }
  return null;
}

function bestMoveDestination(
  gameState: GameState,
  playerId: PlayerId,
  instanceId: string,
): Exclude<PlayDestination, "reserve"> | null {
  if (canMoveTo(gameState, playerId, instanceId, "battleground")) {
    return "battleground";
  }
  if (canMoveTo(gameState, playerId, instanceId, "path")) {
    return "path";
  }
  return null;
}

function ownerForCard(gameState: GameState, instanceId: string): PlayerId | null {
  for (const playerId of turnOrder) {
    const player = gameState.players[playerId];
    if (
      player.hand.includes(instanceId) ||
      player.reserve.includes(instanceId) ||
      player.draw.includes(instanceId) ||
      player.cycle.includes(instanceId) ||
      player.eliminated.includes(instanceId)
    ) {
      return playerId;
    }
  }
  const definition = getCardDefinition(getCard(gameState, instanceId).cardId);
  return definition.owner;
}

function strengthText(card: CardDefinition): string {
  if (card.type === "event") {
    return "E";
  }
  const attack = card.battlegroundAttack + card.leadershipAttack;
  const defense = card.battlegroundDefense + card.leadershipDefense;
  if (attack === 0 && defense === 0 && card.pathIcons > 0) {
    return `P${card.pathIcons}`;
  }
  if (attack === defense) {
    return String(attack);
  }
  return `${attack}/${defense}`;
}

function artKey(card: CardDefinition): string {
  if (card.type === "item") {
    return itemArt(card.title);
  }
  if (card.type === "army") {
    return card.faction === "isengard" ? "uruk" : card.faction;
  }
  if (card.faction === "elf") {
    return "forest";
  }
  if (card.faction === "hobbit") {
    return "shire";
  }
  if (card.faction === "wizard") {
    return "wizard";
  }
  if (card.faction === "dwarf") {
    return "axe";
  }
  if (card.faction === "mordor") {
    return "wraith";
  }
  if (card.faction === "monstrous") {
    return "beast";
  }
  if (card.faction === "southron") {
    return "desert";
  }
  return "council";
}

function itemArt(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("coat") || lower.includes("mail")) {
    return "mail";
  }
  if (lower.includes("axe")) {
    return "axe";
  }
  if (lower.includes("staff") || lower.includes("palantir")) {
    return "tower";
  }
  return "sword";
}

function isPlayerId(value: string | undefined): value is PlayerId {
  return (
    value === "frodo" ||
    value === "aragorn" ||
    value === "witchKing" ||
    value === "saruman"
  );
}

function toneFor(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return `${hash}deg`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
