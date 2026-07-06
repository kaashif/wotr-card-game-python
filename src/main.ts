import "./styles.css";

type Seat = "north" | "east" | "south" | "west";
type Side = "free" | "shadow";
type CardKind = "army" | "character" | "event" | "item";
type CardZone = "hand" | "reserve" | "battle" | "path";

interface PlayerMock {
  readonly id: string;
  readonly name: string;
  readonly seat: Seat;
  readonly side: Side;
  readonly handCount: number;
  readonly deckCount: number;
  readonly cycleCount: number;
  readonly eliminatedCount: number;
}

interface CardMock {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly faction: string;
  readonly kind: CardKind;
  readonly zone: CardZone;
  readonly art: string;
  readonly strength: string;
  readonly text: string;
}

interface LogEntry {
  readonly id: number;
  readonly text: string;
}

interface UiState {
  activePlayerId: string;
  selectedCardId: string;
  zoomCardId: string | null;
  combatPulse: number;
  log: readonly LogEntry[];
}

const players: readonly PlayerMock[] = [
  {
    id: "frodo",
    name: "Frodo",
    seat: "south",
    side: "free",
    handCount: 6,
    deckCount: 18,
    cycleCount: 4,
    eliminatedCount: 1,
  },
  {
    id: "witchKing",
    name: "Witch-king",
    seat: "west",
    side: "shadow",
    handCount: 5,
    deckCount: 21,
    cycleCount: 3,
    eliminatedCount: 2,
  },
  {
    id: "aragorn",
    name: "Aragorn",
    seat: "north",
    side: "free",
    handCount: 5,
    deckCount: 16,
    cycleCount: 6,
    eliminatedCount: 0,
  },
  {
    id: "saruman",
    name: "Saruman",
    seat: "east",
    side: "shadow",
    handCount: 7,
    deckCount: 23,
    cycleCount: 2,
    eliminatedCount: 1,
  },
];

const cards: readonly CardMock[] = [
  {
    id: "sting",
    ownerId: "frodo",
    title: "Sting",
    faction: "Hobbit",
    kind: "item",
    zone: "hand",
    art: "blade",
    strength: "+1",
    text: "If the wielder is on a path with a Monstrous Character then add 1 Defense token to the active path.",
  },
  {
    id: "samwise",
    ownerId: "frodo",
    title: "Samwise the Brave",
    faction: "Hobbit",
    kind: "character",
    zone: "hand",
    art: "shire",
    strength: "2",
    text: "If eliminated in path combat, cycle instead along with any wielded items.",
  },
  {
    id: "mithril",
    ownerId: "frodo",
    title: "Mithril Coat",
    faction: "Dwarf",
    kind: "item",
    zone: "hand",
    art: "mail",
    strength: "+2",
    text: "No rules text. Adds 2 path icons while wielded by Frodo or Sam.",
  },
  {
    id: "gandalf",
    ownerId: "frodo",
    title: "Gandalf the White",
    faction: "Wizard",
    kind: "character",
    zone: "reserve",
    art: "wizard",
    strength: "3",
    text: "When played remove GtG from the game; while in reserve draw +1 card in each Draw step. If forsaken from top of the draw deck, cycle instead.",
  },
  {
    id: "anduril",
    ownerId: "aragorn",
    title: "Anduril",
    faction: "Dunedain",
    kind: "item",
    zone: "hand",
    art: "sword",
    strength: "+3",
    text: "No rules text. Item wielded by Strider or Aragorn with 1 attack icon, 1 defense icon, and 1 path icon.",
  },
  {
    id: "legolas",
    ownerId: "aragorn",
    title: "Legolas",
    faction: "Elf",
    kind: "character",
    zone: "hand",
    art: "forest",
    strength: "3",
    text: "When played you may take the Bow of Galadhrim from your draw deck into hand.",
  },
  {
    id: "elrond",
    ownerId: "aragorn",
    title: "Elrond",
    faction: "Elf",
    kind: "character",
    zone: "reserve",
    art: "council",
    strength: "3",
    text: "When played draw 1 card. While in reserve increase your carryover limit by 1.",
  },
  {
    id: "mordor-host",
    ownerId: "witchKing",
    title: "Mordor Orcs",
    faction: "Mordor",
    kind: "army",
    zone: "hand",
    art: "mordor",
    strength: "4",
    text: "No rules text. Mordor army card with 1 attack icon and 1 defense icon.",
  },
  {
    id: "black-captain",
    ownerId: "witchKing",
    title: "The Black Captain",
    faction: "Mordor",
    kind: "event",
    zone: "hand",
    art: "wraith",
    strength: "3",
    text: "If the Witch-King is in reserve (active or not), (re)activate any Mordor battleground, then you MAY move the Witch-King to this battleground.",
  },
  {
    id: "fell-beast",
    ownerId: "witchKing",
    title: "Fell Beast",
    faction: "Mordor",
    kind: "item",
    zone: "battle",
    art: "beast",
    strength: "2",
    text: "When played on a Nazgul in reserve (active or not), you may immediately move them to a battleground.",
  },
  {
    id: "orthanc",
    ownerId: "saruman",
    title: "Palantir",
    faction: "Isengard",
    kind: "event",
    zone: "hand",
    art: "tower",
    strength: "E",
    text: "If Saruman is in reserve (active or not), (re)activate any Isengard battleground of your choice, then you MAY move Saruman to that battleground.",
  },
  {
    id: "uruk-hai",
    ownerId: "saruman",
    title: "Fighting Uruk-Hai",
    faction: "Isengard",
    kind: "army",
    zone: "hand",
    art: "uruk",
    strength: "3",
    text: "No rules text. Isengard army with battleground attack and defense icons.",
  },
  {
    id: "southron",
    ownerId: "saruman",
    title: "The Black Serpent",
    faction: "Southron",
    kind: "character",
    zone: "path",
    art: "desert",
    strength: "E",
    text: "If in reserve you may use your action and eliminate this card to reactivate any Southron battleground.",
  },
  {
    id: "gimli",
    ownerId: "frodo",
    title: "Gimli",
    faction: "Dwarf",
    kind: "character",
    zone: "battle",
    art: "axe",
    strength: "3",
    text: "When played you may take \"Dwarevn Axe\" from your cycle pile into your hand.",
  },
  {
    id: "gollum",
    ownerId: "saruman",
    title: "Gollum",
    faction: "Monstrous",
    kind: "character",
    zone: "path",
    art: "cavern",
    strength: "E",
    text: "If on a path you may use your action to activate a different path of the same #. If Gollum is eliminated in path combat, cycle instead.",
  },
];

let state: UiState = {
  activePlayerId: "frodo",
  selectedCardId: "sting",
  zoomCardId: null,
  combatPulse: 0,
  log: [
    { id: 5, text: "Fell Beast committed to Minas Tirith." },
    { id: 4, text: "Gimli answered the battleground call." },
    { id: 3, text: "Southron Ambush moved onto the path." },
    { id: 2, text: "Frodo held Mithril Coat in reserve range." },
    { id: 1, text: "Round 3 action phase began from seed table-demo." },
  ],
};

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) {
  throw new Error("Missing #app root");
}
const appRoot = root;
let zoomTimer: number | null = null;

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
  const cardId = cardButton.dataset["cardId"] ?? null;
  zoomTimer = window.setTimeout(() => {
    state = { ...state, zoomCardId: cardId };
    render();
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
  if (state.zoomCardId !== null) {
    state = { ...state, zoomCardId: null };
    render();
  }
});

appRoot.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const playerButton = target.closest<HTMLButtonElement>("[data-player-id]");
  if (playerButton !== null) {
    state = {
      ...state,
      activePlayerId: playerButton.dataset["playerId"] ?? state.activePlayerId,
    };
    render();
    return;
  }

  const cardButton = target.closest<HTMLButtonElement>("[data-card-id]");
  if (cardButton !== null) {
    const cardId = cardButton.dataset["cardId"] ?? state.selectedCardId;
    const card = cards.find((candidate) => candidate.id === cardId);
    state = {
      ...state,
      selectedCardId: cardId,
      activePlayerId: card?.ownerId ?? state.activePlayerId,
      zoomCardId: null,
    };
    render();
    return;
  }

  const actionButton = target.closest<HTMLButtonElement>("[data-action]");
  if (actionButton === null) {
    return;
  }

  const action = actionButton.dataset["action"] ?? "";
  state = {
    ...state,
    combatPulse: state.combatPulse + 1,
    log: [
      {
        id: Date.now(),
        text: actionLog(action, selectedCard().title),
      },
      ...state.log.slice(0, 9),
    ],
  };
  render();
});

render();

function render(): void {
  appRoot.innerHTML = `
    <main class="game-shell" aria-label="War of the Ring table mockup">
      <header class="hud">
        <section class="identity" aria-label="Game">
          <span class="sigil" aria-hidden="true">W</span>
          <div>
            <h1>War of the Ring</h1>
            <p>Round 3 - action phase - seed table-demo</p>
          </div>
        </section>
        <section class="score-track" aria-label="Score">
          <div><span>Free Peoples</span><strong>7</strong></div>
          <div><span>Shadow</span><strong>6</strong></div>
          <div><span>Burden</span><strong>2</strong></div>
        </section>
        <nav class="actions" aria-label="Mock actions">
          <button type="button" data-action="play">Play</button>
          <button type="button" data-action="reserve">Reserve</button>
          <button type="button" data-action="cycle">Cycle</button>
          <button type="button" data-action="resolve">Resolve</button>
        </nav>
      </header>

      <section class="table-layout">
        <section class="table-stage" aria-label="Four player table">
          ${players.map((player) => playerSeat(player)).join("")}
          <section class="felt-table ${state.combatPulse % 2 === 0 ? "" : "pulse"}" aria-label="Play area">
            <div class="table-rim" aria-hidden="true"></div>
            <div class="center-zone battleground-zone">
              <div class="zone-title">
                <span>Battleground</span>
                <strong>Minas Tirith</strong>
                <small>Defense 3 - VP 3</small>
                <p>Dunedain player MAY forsake 1 card to draw 3 cards.</p>
              </div>
              <div class="lane">
                ${cardsInZone("battle").map((card) => cardView(card, "table")).join("")}
              </div>
            </div>
            <div class="center-zone path-zone">
              <div class="zone-title">
                <span>Path</span>
                <strong>Cirith Ungol</strong>
                <small>Path 8 - VP 2</small>
                <p>The Mordor player draws 5 cards, may play 1 Army and cycles rest.</p>
              </div>
              <div class="lane">
                ${cardsInZone("path").map((card) => cardView(card, "table")).join("")}
              </div>
            </div>
            <div class="table-piles" aria-label="Shared piles">
              ${pile("Free battlegrounds", 5, "free")}
              ${pile("Shadow battlegrounds", 6, "shadow")}
              ${pile("Path deck", 3, "path")}
            </div>
          </section>
        </section>

        <aside class="event-log" aria-label="Event log">
          <div class="panel-head">
            <span>Event Log</span>
            <strong>${state.log.length}</strong>
          </div>
          <ol>
            ${state.log.map((entry) => `<li>${escapeHtml(entry.text)}</li>`).join("")}
          </ol>
          <section class="selection">
            <span>Selected</span>
            ${cardInspector(selectedCard())}
          </section>
        </aside>
      </section>
      ${state.zoomCardId === null ? "" : zoomCard(cards.find((card) => card.id === state.zoomCardId) ?? selectedCard())}
    </main>
  `;
}

function playerSeat(player: PlayerMock): string {
  const active = player.id === state.activePlayerId ? " active" : "";
  const handCards = cards.filter(
    (card) => card.ownerId === player.id && card.zone === "hand",
  );
  return `
    <section class="seat seat-${player.seat}${active}" aria-label="${escapeHtml(player.name)} seat">
      <button class="player-chip" type="button" data-player-id="${player.id}">
        <span>${escapeHtml(player.name)}</span>
        <small>${player.side === "free" ? "Free Peoples" : "Shadow"} - ${player.handCount} cards</small>
      </button>
      <div class="hand-fan" style="--cards: ${handCards.length}">
        ${handCards.map((card, index) => cardView(card, "hand", index)).join("")}
      </div>
      <div class="personal-piles" aria-label="${escapeHtml(player.name)} piles">
        ${pile("Draw", player.deckCount, player.side)}
        ${pile("Cycle", player.cycleCount, "neutral")}
        ${pile("Eliminated", player.eliminatedCount, "spent")}
      </div>
    </section>
  `;
}

function cardView(card: CardMock, context: "hand" | "table", index = 0): string {
  const selected = card.id === state.selectedCardId ? " selected" : "";
  return `
    <button
      class="game-card ${context}${selected}"
      type="button"
      data-card-id="${card.id}"
      style="--i: ${index}; --tone: ${toneFor(card.title)}"
      aria-pressed="${card.id === state.selectedCardId ? "true" : "false"}"
    >
      <span class="card-kind">${escapeHtml(card.kind)}</span>
      <strong>${escapeHtml(card.title)}</strong>
      <span class="card-art art-${card.art}" aria-hidden="true">
        <i></i><b></b><em></em>
      </span>
      <span class="card-meta">
        <small>${escapeHtml(card.faction)}</small>
        <mark>${escapeHtml(card.strength)}</mark>
      </span>
      <p>${escapeHtml(card.text)}</p>
    </button>
  `;
}

function cardInspector(card: CardMock): string {
  return `
    <article class="inspector-card">
      <div class="mini-art art-${card.art}" aria-hidden="true"><i></i><b></b><em></em></div>
      <div>
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.faction)} ${escapeHtml(card.kind)} - ${escapeHtml(card.text)}</p>
      </div>
    </article>
  `;
}

function zoomCard(card: CardMock): string {
  return `
    <aside class="zoom-preview" aria-live="polite" aria-label="Card preview">
      <article class="zoom-card" style="--tone: ${toneFor(card.title)}">
        <span class="card-kind">${escapeHtml(card.kind)}</span>
        <strong>${escapeHtml(card.title)}</strong>
        <span class="card-art art-${card.art}" aria-hidden="true">
          <i></i><b></b><em></em>
        </span>
        <span class="card-meta">
          <small>${escapeHtml(card.faction)}</small>
          <mark>${escapeHtml(card.strength)}</mark>
        </span>
        <p>${escapeHtml(card.text)}</p>
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

function cardsInZone(zone: CardZone): readonly CardMock[] {
  return cards.filter((card) => card.zone === zone);
}

function selectedCard(): CardMock {
  const fallback = cards[0];
  if (fallback === undefined) {
    throw new Error("Mock UI requires at least one card");
  }
  return cards.find((card) => card.id === state.selectedCardId) ?? fallback;
}

function clearZoomTimer(): void {
  if (zoomTimer !== null) {
    window.clearTimeout(zoomTimer);
    zoomTimer = null;
  }
}

function actionLog(action: string, title: string): string {
  switch (action) {
    case "play":
      return `${title} slides from hand toward the active table zone.`;
    case "reserve":
      return `${title} is staged in reserve for a later window.`;
    case "cycle":
      return `${title} cycles with a new card drawn from the pile.`;
    case "resolve":
      return `Combat resolves at Minas Tirith; committed cards pulse on the felt.`;
    default:
      return `${title} was inspected.`;
  }
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
