import {
  battlegroundDefinitions,
  cardDefinitions,
  pathDefinitions,
  players,
  turnOrder,
} from "./data";
import {
  getCardEffectImplementation,
  type EffectInstruction,
  type EffectTarget,
  type SearchZone,
} from "./cardEffectScripts";
import type {
  ActiveBattleground,
  ActivePath,
  CardDefinition,
  CardInstance,
  CommandResult,
  ForsakeSource,
  Faction,
  GameEvent,
  GameState,
  Phase,
  PendingDecision,
  PlayDestination,
  PlayerId,
  PlayerState,
  RuleViolation,
  Side,
} from "./types";

type EliminationContext = "effect" | "forsake" | "pathCombat" | "battlegroundCombat";

const startingHandSize = 7;
const setupCycleCount = 2;
const handLimit = 6;
const baseCarryoverLimit = 2;

const cardById: ReadonlyMap<string, CardDefinition> = new Map(
  cardDefinitions.map((card) => [card.id, card]),
);
const battlegroundById: ReadonlyMap<string, (typeof battlegroundDefinitions)[number]> = new Map(
  battlegroundDefinitions.map((battleground) => [battleground.id, battleground]),
);
const pathById: ReadonlyMap<string, (typeof pathDefinitions)[number]> = new Map(
  pathDefinitions.map((path) => [path.id, path]),
);

export function getCardDefinition(cardId: string): CardDefinition {
  const card = cardById.get(cardId);
  if (card === undefined) {
    throw new Error(`Unknown card definition: ${cardId}`);
  }
  return card;
}

export function getCard(state: GameState, instanceId: string): CardInstance {
  const card = state.cards[instanceId];
  if (card === undefined) {
    throw new Error(`Unknown card instance: ${instanceId}`);
  }
  return card;
}

export function getSideForRound(round: number): Side {
  return round % 2 === 1 ? "free" : "shadow";
}

export function createGame(seed = String(Date.now())): GameState {
  const rng = mulberry32(hashSeed(seed));
  const instances: Record<string, CardInstance> = {};
  const playerStates = Object.fromEntries(
    turnOrder.map((playerId) => {
      const player = players[playerId];
      const deckDefinitions = cardDefinitions.filter((card) =>
        (player.factions as readonly string[]).includes(card.faction),
      );
      const deck = deckDefinitions.flatMap((card) =>
        Array.from({ length: copiesFor(card) }, (_, copyIndex) => {
          const instanceId = `${playerId}-${card.id}-${copyIndex + 1}`;
          instances[instanceId] = { instanceId, cardId: card.id };
          return instanceId;
        }),
      );
      const shuffled = shuffle(deck, rng);
      const hand = shuffled.slice(0, startingHandSize);
      const cycle = hand.slice(0, setupCycleCount);
      const keptHand = hand.slice(setupCycleCount);
      const draw = shuffled.slice(startingHandSize);
      const state: PlayerState = {
        id: playerId,
        draw,
        hand: keptHand,
        cycle,
        eliminated: [],
        reserve: [],
        usedRingToken: false,
        passed: false,
      };
      return [playerId, state];
    }),
  ) as Record<PlayerId, PlayerState>;

  const initial: GameState = {
    schemaVersion: 1,
    seed,
    round: 1,
    phase: "setup",
    activePlayer: "frodo",
    currentPathNumber: 1,
    battlegroundDecks: {
      free: shuffle(
        battlegroundDefinitions
          .filter((battleground) => battleground.side === "free")
          .map((battleground) => battleground.id),
        rng,
      ),
      shadow: shuffle(
        battlegroundDefinitions
          .filter((battleground) => battleground.side === "shadow")
          .map((battleground) => battleground.id),
        rng,
      ),
    },
    pathDeck: pathDefinitions.map((path) => path.id),
    activatedPaths: [],
    activeBattleground: null,
    activePath: null,
    players: playerStates,
    cards: instances,
    attachments: {},
    roundMemory: { playedToReserve: [], playedCharacterOrItemCards: [] },
    pendingDecisions: [],
    eventLog: [],
    scoringAreas: {
      battlegrounds: { free: [], shadow: [] },
      paths: { free: [], shadow: [] },
    },
    corruption: { tokens: 0 },
    score: { free: 0, shadow: 0 },
    log: [],
    selection: { playerId: "frodo", cardId: null },
  };

  return startRound(
    addLog(initial, `New game started with seed ${seed}. Opening cycles done.`),
  );
}

export function selectPlayer(state: GameState, playerId: PlayerId): GameState {
  return {
    ...state,
    selection: { playerId, cardId: state.players[playerId].hand[0] ?? null },
  };
}

export function selectCard(state: GameState, instanceId: string | null): GameState {
  return {
    ...state,
    selection: { ...state.selection, cardId: instanceId },
  };
}

export function playSelected(
  state: GameState,
  destination: PlayDestination,
): GameState {
  const instanceId = state.selection.cardId;
  const playerId = state.selection.playerId;
  if (instanceId === null) {
    return addLog(state, "Select a card first.");
  }
  return playCard(state, playerId, instanceId, destination);
}

export function tryPlayCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  destination: PlayDestination,
  costCardId?: string,
): CommandResult {
  const turnViolation = validateActionTurn(state, playerId);
  if (turnViolation !== null) {
    return rejected(state, turnViolation);
  }
  if (!canPlayTo(state, playerId, instanceId, destination)) {
    return rejected(state, {
      code: "invalid-destination",
      message: "That card cannot be played there.",
      source: "rules:151-199",
    });
  }
  const cardDef = getCardDefinition(getCard(state, instanceId).cardId);
  if (
    (cardDef.type === "character" || cardDef.type === "item") &&
    state.roundMemory.playedCharacterOrItemCards.includes(cardDef.id)
  ) {
    return rejected(state, {
      code: "repeat-character-or-item-this-round",
      message: "The exact same character or item card cannot be played twice in one round.",
      source: "rules:217",
    });
  }
  const nextState = playCard(state, playerId, instanceId, destination, costCardId);
  return accepted(nextState, [
    { type: "cardPlayed", playerId, cardId: instanceId, destination },
  ]);
}

export function playCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  destination: PlayDestination,
  costCardId?: string,
): GameState {
  if (!canPlayTo(state, playerId, instanceId, destination)) {
    return addLog(state, "That card cannot be played there.");
  }

  const player = state.players[playerId];
  const nextHand = removeOne(player.hand, instanceId);
  const requiredCycle = costCardId ?? nextHand[0] ?? null;
  const nextPlayer = { ...player, hand: nextHand };
  const card = getCard(state, instanceId);
  const cardDef = getCardDefinition(card.cardId);

  let nextState: GameState = {
    ...state,
    players: setPlayer(state.players, playerId, nextPlayer),
    selection: { ...state.selection, cardId: nextHand[0] ?? null },
  };

  if (destination === "reserve") {
    nextState = {
      ...updatePlayer(nextState, playerId, (current) => ({
        ...current,
        reserve: [...current.reserve, instanceId],
      })),
      roundMemory: {
        ...nextState.roundMemory,
        playedToReserve: [...nextState.roundMemory.playedToReserve, instanceId],
      },
    };
  } else if (destination === "battleground") {
    nextState = {
      ...nextState,
      activeBattleground:
        nextState.activeBattleground === null
          ? null
          : {
              ...nextState.activeBattleground,
              cards: [...nextState.activeBattleground.cards, instanceId],
            },
    };
  } else {
    nextState = {
      ...nextState,
      activePath:
        nextState.activePath === null
          ? null
          : {
              ...nextState.activePath,
              cards: [...nextState.activePath.cards, instanceId],
            },
    };
  }

  if (requiredCycle !== null) {
    if (requiredCycle === instanceId || !nextHand.includes(requiredCycle)) {
      return addLog(state, "Playing a card requires cycling a different hand card.");
    }
    nextState = updatePlayer(nextState, playerId, (current) => ({
      ...current,
      hand: removeOne(current.hand, requiredCycle),
      cycle: [...current.cycle, requiredCycle],
    }));
  } else {
    nextState = forsakeFromTopOfDeck(nextState, playerId);
  }

  if (cardDef.type === "character" || cardDef.type === "item") {
    nextState = rememberCharacterOrItemPlayed(nextState, cardDef.id);
  }
  if (cardDef.type === "event") {
    nextState = rememberCharacterOrItemPlayed(nextState, cardDef.id);
  }

  nextState = applyRuntimeCardScripts(nextState, cardDef.id, "whenPlayed", playerId);
  if (destination !== "reserve") {
    nextState = applyRuntimeCardScripts(nextState, cardDef.id, "whenPlayedOrMoved", playerId);
  }
  if (cardDef.type === "event") {
    nextState = eliminateCards(nextState, [instanceId], "effect");
  }

  return addLog(
    nextState,
    `${players[playerId].name} played ${cardDef.title} to ${destination}.`,
  );
}

export function tryAttachItem(
  state: GameState,
  playerId: PlayerId,
  itemId: string,
  wielderId: string,
  costCardId?: string,
): CommandResult {
  const turnViolation = validateActionTurn(state, playerId);
  if (turnViolation !== null) {
    return rejected(state, turnViolation);
  }

  const player = state.players[playerId];
  if (!player.hand.includes(itemId)) {
    return rejected(state, {
      code: "card-not-in-hand",
      message: "Only an item in hand can be attached.",
      source: "rules:173-177",
    });
  }
  const itemDef = getCardDefinition(getCard(state, itemId).cardId);
  if (itemDef.type !== "item") {
    return rejected(state, {
      code: "invalid-wielder",
      message: "Only item cards can be attached to a wielder.",
      source: "rules:173",
    });
  }
  if (state.roundMemory.playedCharacterOrItemCards.includes(itemDef.id)) {
    return rejected(state, {
      code: "repeat-character-or-item-this-round",
      message: "The exact same character or item card cannot be played twice in one round.",
      source: "rules:217",
    });
  }
  if (!isValidWielder(state, itemDef, wielderId)) {
    return rejected(state, {
      code: "invalid-wielder",
      message: "An item can only be played on an indicated character already in play.",
      source: "rules:173-177",
    });
  }
  if (Object.values(state.attachments).some((items) => items.includes(itemId))) {
    return rejected(state, {
      code: "item-already-attached",
      message: "That item is already attached.",
      source: "rules:187",
    });
  }

  const nextState = attachItem(state, playerId, itemId, wielderId, costCardId);
  return accepted(nextState, [
    { type: "itemAttached", playerId, itemId, wielderId },
  ]);
}

export function attachItem(
  state: GameState,
  playerId: PlayerId,
  itemId: string,
  wielderId: string,
  costCardId?: string,
): GameState {
  const player = state.players[playerId];
  const nextHand = removeOne(player.hand, itemId);
  const requiredCycle = costCardId ?? nextHand[0] ?? null;
  let nextState: GameState = {
    ...state,
    players: setPlayer(state.players, playerId, { ...player, hand: nextHand }),
    attachments: {
      ...state.attachments,
      [wielderId]: [...(state.attachments[wielderId] ?? []), itemId],
    },
    selection: { ...state.selection, cardId: nextHand[0] ?? null },
  };

  if (requiredCycle !== null) {
    if (requiredCycle === itemId || !nextHand.includes(requiredCycle)) {
      return addLog(state, "Playing an item requires cycling a different hand card.");
    }
    nextState = updatePlayer(nextState, playerId, (current) => ({
      ...current,
      hand: removeOne(current.hand, requiredCycle),
      cycle: [...current.cycle, requiredCycle],
    }));
  } else {
    nextState = forsakeFromTopOfDeck(nextState, playerId);
  }

  const itemDef = getCardDefinition(getCard(state, itemId).cardId);
  return addLog(
    rememberCharacterOrItemPlayed(nextState, itemDef.id),
    `${players[playerId].name} attached ${itemDef.title}.`,
  );
}

export function cycleSelected(state: GameState): GameState {
  const instanceId = state.selection.cardId;
  const playerId = state.selection.playerId;
  if (instanceId === null) {
    return addLog(state, "Select a card to cycle.");
  }
  return cycleCard(state, playerId, instanceId);
}

export function cycleCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  if (!player.hand.includes(instanceId)) {
    return addLog(state, "Only cards in hand can be cycled.");
  }
  const card = getCard(state, instanceId);
  const cardDef = getCardDefinition(card.cardId);
  const nextHand = removeOne(player.hand, instanceId);
  const nextState = updatePlayer(state, playerId, (current) => ({
    ...current,
    hand: nextHand,
    cycle: [...current.cycle, instanceId],
  }));
  return addLog(
    {
      ...nextState,
      selection: { ...nextState.selection, cardId: nextHand[0] ?? null },
    },
    `${players[playerId].name} cycled ${cardDef.title}.`,
  );
}

export function useRingToken(state: GameState): GameState {
  const playerId = state.selection.playerId;
  return usePlayerRingToken(state, playerId);
}

export function usePlayerRingToken(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const player = state.players[playerId];
  if (player.usedRingToken) {
    return addLog(state, `${players[playerId].name} already used a ring token.`);
  }
  const nextState = updatePlayer(state, playerId, (current) => ({
    ...current,
    usedRingToken: true,
  }));
  return addLog(
    drawCards(nextState, playerId, 2),
    `${players[playerId].name} used a ring token and drew 2 cards.`,
  );
}

export function drawForPlayer(state: GameState, playerId: PlayerId, count: number): GameState {
  return drawCards(state, playerId, count);
}

export function tryPass(state: GameState): CommandResult {
  const playerId = state.activePlayer;
  const turnViolation = validateActionTurn(state, playerId);
  if (turnViolation !== null) {
    return rejected(state, turnViolation);
  }
  if (!canPass(state, playerId)) {
    return rejected(state, {
      code: "pass-not-allowed",
      message: "A player can pass only under carryover or enemy-hand conditions.",
      source: "rules:142-145",
    });
  }
  return accepted(pass(state), [{ type: "playerPassed", playerId }]);
}

export function pass(state: GameState): GameState {
  const playerId = state.activePlayer;
  if (!canPass(state, playerId)) {
    return addLog(state, `${players[playerId].name} cannot pass yet.`);
  }
  const nextState = updatePlayer(state, playerId, (player) => ({
    ...player,
    passed: true,
  }));
  const allPassed = turnOrder.every(
    (candidate) => nextState.players[candidate].passed,
  );
  if (allPassed) {
    return resolveCombat({ ...nextState, phase: "combat" });
  }
  return addLog(
    { ...nextState, activePlayer: nextPlayerId(playerId) },
    `${players[playerId].name} passed.`,
  );
}

export function canPass(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  if (player.hand.length <= carryoverLimit(state, playerId)) {
    return true;
  }
  return enemyPlayers(playerId).every(
    (enemyId) => player.hand.length < state.players[enemyId].hand.length,
  );
}

export function tryMoveFromReserve(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  destination: Exclude<PlayDestination, "reserve">,
): CommandResult {
  const turnViolation = validateActionTurn(state, playerId);
  if (turnViolation !== null) {
    return rejected(state, turnViolation);
  }
  const player = state.players[playerId];
  if (!player.reserve.includes(instanceId)) {
    return rejected(state, {
      code: "card-not-in-reserve",
      message: "Only a card in reserve can be moved.",
      source: "rules:222-227",
    });
  }
  if (state.roundMemory.playedToReserve.includes(instanceId)) {
    return rejected(state, {
      code: "reserve-card-played-this-round",
      message: "Cards played to reserve cannot be moved in the same round.",
      source: "rules:200-206",
    });
  }
  if (!canMoveTo(state, playerId, instanceId, destination)) {
    return rejected(state, {
      code: "invalid-destination",
      message: "That reserve card cannot be moved there.",
      source: "rules:222-227",
    });
  }
  return accepted(moveFromReserve(state, playerId, instanceId, destination), [
    { type: "cardMoved", playerId, cardId: instanceId, destination },
  ]);
}

export function moveFromReserve(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  destination: Exclude<PlayDestination, "reserve">,
): GameState {
  const cardDef = getCardDefinition(getCard(state, instanceId).cardId);
  let nextState = updatePlayer(state, playerId, (player) => ({
    ...player,
    reserve: removeOne(player.reserve, instanceId),
  }));

  if (destination === "battleground") {
    nextState = {
      ...nextState,
      activeBattleground:
        nextState.activeBattleground === null
          ? null
          : {
              ...nextState.activeBattleground,
              cards: [...nextState.activeBattleground.cards, instanceId],
            },
    };
  } else {
    nextState = {
      ...nextState,
      activePath:
        nextState.activePath === null
          ? null
          : {
              ...nextState.activePath,
              cards: [...nextState.activePath.cards, instanceId],
            },
    };
  }

  nextState = applyRuntimeCardScripts(nextState, cardDef.id, "whenPlayedOrMoved", playerId);

  return addLog(
    nextState,
    `${players[playerId].name} moved ${cardDef.title} to ${destination}.`,
  );
}

export function tryWinnow(
  state: GameState,
  playerId: PlayerId,
  firstCardId: string,
  secondCardId: string,
): CommandResult {
  const turnViolation = validateActionTurn(state, playerId);
  if (turnViolation !== null) {
    return rejected(state, turnViolation);
  }
  const player = state.players[playerId];
  if (
    firstCardId === secondCardId ||
    !player.hand.includes(firstCardId) ||
    !player.hand.includes(secondCardId)
  ) {
    return rejected(state, {
      code: "insufficient-hand-cards",
      message: "Winnow requires eliminating two different cards from hand.",
      source: "rules:138,242",
    });
  }
  return accepted(winnow(state, playerId, firstCardId, secondCardId), [
    { type: "winnowed", playerId, cards: [firstCardId, secondCardId] },
  ]);
}

export function winnow(
  state: GameState,
  playerId: PlayerId,
  firstCardId: string,
  secondCardId: string,
): GameState {
  const nextState = drawCards(
    eliminateCards(state, [firstCardId, secondCardId], "effect"),
    playerId,
    1,
  );
  return addLog(nextState, `${players[playerId].name} winnowed 2 cards.`);
}

export function tryForsake(
  state: GameState,
  playerId: PlayerId,
  source: ForsakeSource,
  instanceId?: string,
): CommandResult {
  const nextState = forsakeCard(state, playerId, source, instanceId);
  if (nextState === null) {
    return rejected(state, {
      code: "invalid-forsake-source",
      message: "Forsake must choose a card from hand, reserve, or the top of the draw deck.",
      source: "rules:385-395",
    });
  }
  return accepted(nextState, [
    instanceId === undefined
      ? { type: "cardForsaken", playerId, source }
      : { type: "cardForsaken", playerId, source, cardId: instanceId },
  ]);
}

export function forsakeCard(
  state: GameState,
  playerId: PlayerId,
  source: ForsakeSource,
  instanceId?: string,
): GameState | null {
  const player = state.players[playerId];
  if (source === "draw") {
    return forsakeFromTopOfDeck(state, playerId);
  }
  if (instanceId === undefined) {
    return null;
  }
  if (source === "hand" && player.hand.includes(instanceId)) {
    return eliminateCards(state, [instanceId], "forsake");
  }
  if (source === "reserve" && player.reserve.includes(instanceId)) {
    return eliminateCards(state, [instanceId], "forsake");
  }
  return null;
}

export function addCorruption(state: GameState, count: number): GameState {
  if (count <= 0) {
    return state;
  }
  return {
    ...state,
    corruption: { tokens: state.corruption.tokens + count },
    score: { ...state.score, shadow: state.score.shadow + count },
  };
}

export function removeCorruption(state: GameState, count: number): GameState {
  if (count <= 0) {
    return state;
  }
  const removed = Math.min(count, state.corruption.tokens);
  return {
    ...state,
    corruption: { tokens: state.corruption.tokens - removed },
    score: { ...state.score, shadow: Math.max(0, state.score.shadow - removed) },
  };
}

export function addActivePathAttackTokens(state: GameState, count: number): GameState {
  if (count <= 0 || state.activePath === null) {
    return state;
  }
  return {
    ...state,
    activePath: {
      ...state.activePath,
      attackTokens: state.activePath.attackTokens + count,
    },
  };
}

export function addActivePathDefenseTokens(state: GameState, count: number): GameState {
  if (count <= 0 || state.activePath === null) {
    return state;
  }
  return {
    ...state,
    activePath: {
      ...state.activePath,
      defenseTokens: state.activePath.defenseTokens + count,
    },
  };
}

export function activatePathById(state: GameState, pathId: string): GameState | null {
  const path = pathById.get(pathId);
  if (path === undefined || state.activatedPaths.includes(pathId)) {
    return null;
  }
  let nextState = state.activePath === null ? state : scorePath(state, state.activePath);
  nextState = removeScoredActivePathCards(nextState);
  return addLog(
    {
      ...nextState,
      activePath: { id: pathId, cards: [], attackTokens: 0, defenseTokens: 0 },
      pathDeck: nextState.pathDeck.filter((id) => id !== pathId),
      activatedPaths: [...nextState.activatedPaths, pathId],
    },
    `Activated ${path.title}.`,
  );
}

export function eligiblePathsByNumber(
  state: GameState,
  pathNumber: number,
): readonly string[] {
  return pathDefinitions
    .filter((path) => path.pathNumber === pathNumber)
    .map((path) => path.id)
    .filter((pathId) => !state.activatedPaths.includes(pathId));
}

export function enqueuePendingDecision(
  state: GameState,
  decision: PendingDecision,
): GameState {
  return {
    ...state,
    pendingDecisions: [...state.pendingDecisions, decision],
    eventLog: [
      ...state.eventLog,
      { type: "pendingDecisionCreated", decision },
    ],
  };
}

export function resolveOldestPendingDecision(state: GameState): GameState {
  const [, ...remaining] = state.pendingDecisions;
  return { ...state, pendingDecisions: remaining };
}

export function nextTurn(state: GameState): GameState {
  return {
    ...state,
    activePlayer: nextPlayerId(state.activePlayer),
  };
}

export function resolveCombat(state: GameState): GameState {
  let nextState = state;
  const battleground = state.activeBattleground;
  if (battleground !== null) {
    nextState = scoreBattleground(nextState, battleground);
  }

  const path = nextState.activePath;
  if (path !== null) {
    nextState = scorePath(nextState, path);
  }

  if (nextState.currentPathNumber >= 9) {
    return addLog(
      { ...nextState, phase: "gameOver", activeBattleground: null, activePath: null },
      "Game over after Mount Doom.",
    );
  }

  nextState = executeDrawStep(nextState);
  return startRound({
    ...nextState,
    phase: "action",
    round: nextState.round + 1,
    currentPathNumber: nextState.currentPathNumber + 1,
    activeBattleground: null,
    activePath: null,
    players: mapPlayers(nextState.players, (player) => ({
      ...player,
      passed: false,
    })),
  });
}

export function discardOversizedHands(state: GameState): GameState {
  return Object.values(state.players).reduce((nextState, player) => {
    if (player.hand.length <= handLimit) {
      return nextState;
    }
    const toCycle = player.hand.slice(handLimit);
    return updatePlayer(nextState, player.id, (current) => ({
      ...current,
      hand: current.hand.slice(0, handLimit),
      cycle: [...current.cycle, ...toCycle],
    }));
  }, state);
}

export function validateState(state: GameState): readonly string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const allZones: readonly (readonly string[])[] = [
    ...turnOrder.flatMap((playerId) => {
      const player = state.players[playerId];
      return [
        player.draw,
        player.hand,
        player.cycle,
        player.eliminated,
        player.reserve,
      ];
    }),
    state.activeBattleground?.cards ?? [],
    state.activePath?.cards ?? [],
    ...Object.values(state.attachments),
  ];

  for (const zone of allZones) {
    for (const instanceId of zone) {
      if (state.cards[instanceId] === undefined) {
        errors.push(`Unknown card instance in zone: ${instanceId}`);
      }
      if (seen.has(instanceId)) {
        errors.push(`Duplicate card instance across zones: ${instanceId}`);
      }
      seen.add(instanceId);
    }
  }

  for (const instanceId of Object.keys(state.cards)) {
    if (!seen.has(instanceId)) {
      errors.push(`Card instance missing from all zones: ${instanceId}`);
    }
  }

  if (state.activeBattleground !== null) {
    const battleground = battlegroundById.get(state.activeBattleground.id);
    if (battleground === undefined) {
      errors.push(`Unknown active battleground: ${state.activeBattleground.id}`);
    }
  }

  if (state.activePath !== null) {
    const path = pathById.get(state.activePath.id);
    if (path === undefined) {
      errors.push(`Unknown active path: ${state.activePath.id}`);
    }
  }

  for (const [wielderId, itemIds] of Object.entries(state.attachments)) {
    const wielder = state.cards[wielderId];
    if (wielder === undefined) {
      errors.push(`Attachment references unknown wielder: ${wielderId}`);
      continue;
    }
    const wielderDef = getCardDefinition(wielder.cardId);
    if (wielderDef.type !== "character") {
      errors.push(`Attachment wielder is not a character: ${wielderId}`);
    }
    if (!isInPlay(state, wielderId)) {
      errors.push(`Attachment wielder is not in play: ${wielderId}`);
    }
    for (const itemId of itemIds) {
      const item = state.cards[itemId];
      if (item === undefined) {
        errors.push(`Attachment references unknown item: ${itemId}`);
        continue;
      }
      const itemDef = getCardDefinition(item.cardId);
      if (itemDef.type !== "item") {
        errors.push(`Attached card is not an item: ${itemId}`);
      }
      if (!isAllowedWielderName(itemDef, wielderDef.title)) {
        errors.push(`Item ${itemId} cannot be attached to ${wielderId}`);
      }
    }
  }

  return errors;
}

export function canPlayTo(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  destination: PlayDestination,
): boolean {
  const player = state.players[playerId];
  if (!player.hand.includes(instanceId)) {
    return false;
  }
  const card = getCard(state, instanceId);
  const cardDef = getCardDefinition(card.cardId);
  if (violatesPlayRestriction(state, cardDef, destination)) {
    return false;
  }
  if (destination === "reserve") {
    return cardDef.type === "army" || cardDef.type === "character" || cardDef.type === "event";
  }
  if (destination === "battleground") {
    const battleground = state.activeBattleground;
    if (battleground === null || cardDef.type === "event" || cardDef.type === "item") {
      return false;
    }
    const battlegroundDef = battlegroundById.get(battleground.id);
    if (battlegroundDef === undefined) {
      return false;
    }
    const playableFactions: readonly string[] = [
      ...battlegroundDef.attackingFactions,
      ...battlegroundDef.defendingFactions,
    ];
    return (
      playableFactions.includes(cardDef.faction) ||
      hasExpandedBattlegroundAccess(state, cardDef, battleground.id)
    );
  }
  const path = state.activePath;
  return (
    path !== null &&
    cardDef.type === "character" &&
    cardDef.allowedPaths.includes(pathById.get(path.id)?.pathNumber ?? -1)
  );
}

export function canMoveTo(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  destination: Exclude<PlayDestination, "reserve">,
): boolean {
  const player = state.players[playerId];
  if (!player.reserve.includes(instanceId)) {
    return false;
  }
  const card = getCard(state, instanceId);
  const cardDef = getCardDefinition(card.cardId);
  if (violatesPlayRestriction(state, cardDef, destination)) {
    return false;
  }
  if (cardDef.type !== "army" && cardDef.type !== "character") {
    return false;
  }
  if (destination === "path") {
    const path = state.activePath;
    return (
      path !== null &&
      cardDef.type === "character" &&
      cardDef.allowedPaths.includes(pathById.get(path.id)?.pathNumber ?? -1)
    );
  }
  const battleground = state.activeBattleground;
  if (battleground === null) {
    return false;
  }
  const battlegroundDef = battlegroundById.get(battleground.id);
  if (battlegroundDef === undefined) {
    return false;
  }
  const playableFactions: readonly Faction[] = [
    ...battlegroundDef.attackingFactions,
    ...battlegroundDef.defendingFactions,
  ];
  return (
    playableFactions.includes(cardDef.faction) ||
    hasExpandedBattlegroundAccess(state, cardDef, battleground.id)
  );
}

function applyRuntimeCardScripts(
  state: GameState,
  cardId: string,
  timing: "whenPlayed" | "whenPlayedOrMoved" | "whileInReserve",
  controller: PlayerId,
): GameState {
  return getCardEffectImplementation(cardId).scripts
    .filter((script) => script.timing === timing)
    .flatMap((script) => script.instructions)
    .reduce(
      (nextState, instruction) => applyRuntimeInstruction(nextState, instruction, controller),
      state,
    );
}

function applyRuntimeInstruction(
  state: GameState,
  instruction: EffectInstruction,
  controller: PlayerId,
): GameState {
  switch (instruction.type) {
    case "noop":
    case "todo":
    case "replacementCycleInstead":
    case "modifyCarryover":
    case "conditionalCombatModifier":
    case "playRestriction":
    case "roundRuleModifier":
    case "replacementEffect":
      return state;
    case "draw":
      return targetPlayers(instruction.target, controller).reduce(
        (nextState, playerId) => drawCards(nextState, playerId, instruction.count),
        state,
      );
    case "addPathAttack":
      return addActivePathAttackTokens(state, instruction.count);
    case "addPathDefense":
      return addActivePathDefenseTokens(state, instruction.count);
    case "addBattlegroundAttack":
      return addActiveBattlegroundAttackTokens(state, instruction.count);
    case "addBattlegroundDefense":
      return addActiveBattlegroundDefenseTokens(state, instruction.count);
    case "addCorruption":
      return addCorruption(state, instruction.count);
    case "removeCorruption":
      return removeCorruption(
        state,
        instruction.count === "hobbitsOnPath" ? hobbitsOnActivePath(state) : instruction.count,
      );
    case "forsake":
      return enqueueForRuntimeTargets(state, instruction.target, controller, (playerId) => ({
        type: "forsake",
        playerId,
        reason: "card effect",
        minimum: instruction.count,
        source: "card-effect-script",
      }));
    case "cycleFromHand":
      return enqueueForRuntimeTargets(state, instruction.target, controller, (playerId) => ({
        type: "forsake",
        playerId,
        reason: `cycle ${instruction.count} from hand`,
        minimum: instruction.count,
        source: "card-effect-script:cycle-from-hand",
      }));
    case "search":
      return enqueueForRuntimeTargets(state, instruction.target, controller, (playerId) => ({
        type: "search",
        playerId,
        zones: instruction.from,
        choices: searchChoices(state, playerId, instruction.from, instruction.query),
        source: instruction.query,
      }));
    case "activatePath":
    case "activateBattleground":
    case "moveWielder":
    case "cycleSelf":
    case "eliminateSelf":
    case "cycleRestDrawn":
      return enqueuePendingDecision(state, {
        type: "search",
        playerId: controller,
        zones: ["inPlay"],
        choices: [],
        source: `unresolved:${instruction.type}`,
      });
    case "playFromDrawn":
      return enqueuePendingDecision(state, {
        type: "drawPlayCycleRest",
        playerId: controller,
        drawnCards: [],
        playableCards: [],
        maxPlays: instruction.max,
        source: instruction.filter,
      });
  }
}

function enqueueForRuntimeTargets(
  state: GameState,
  target: EffectTarget,
  controller: PlayerId,
  decision: (playerId: PlayerId) => PendingDecision,
): GameState {
  return targetPlayers(target, controller).reduce(
    (nextState, playerId) => enqueuePendingDecision(nextState, decision(playerId)),
    state,
  );
}

function targetPlayers(target: EffectTarget, controller: PlayerId): readonly PlayerId[] {
  switch (target) {
    case "self":
    case "owner":
      return [controller];
    case "freePlayers":
      return turnOrder.filter((playerId) => players[playerId].side === "free");
    case "shadowPlayers":
      return turnOrder.filter((playerId) => players[playerId].side === "shadow");
    case "eachPlayer":
      return turnOrder;
    case "hobbitPlayer":
      return ["frodo"];
    case "mordorPlayer":
      return ["witchKing"];
    case "elfPlayer":
    case "dunedainPlayer":
      return ["aragorn"];
    case "monstrousPlayer":
    case "isengardPlayer":
      return ["saruman"];
    case "rohanPlayer":
      return ["frodo"];
  }
}

function searchChoices(
  state: GameState,
  playerId: PlayerId,
  zones: readonly SearchZone[],
  query: string,
): readonly string[] {
  const normalizedQuery = normalizeName(query);
  return zones.flatMap((zone) => zoneCards(state, playerId, zone)).filter((instanceId) => {
    const card = getCardDefinition(getCard(state, instanceId).cardId);
    const title = normalizeName(card.title);
    if (normalizedQuery.includes("hobbit character")) {
      return card.type === "character" && card.faction === "hobbit";
    }
    if (normalizedQuery.includes("nazgul character")) {
      return card.type === "character" && title.includes("nazgul");
    }
    if (normalizedQuery.includes("rohan character")) {
      return card.type === "character" && card.faction === "rohan";
    }
    if (normalizedQuery.includes("saruman")) {
      return title.includes("saruman");
    }
    if (normalizedQuery.includes("gandalf")) {
      return title.includes("gandalf");
    }
    if (normalizedQuery.includes("strider") || normalizedQuery.includes("aragorn")) {
      return title.includes("strider") || title === "aragorn";
    }
    if (normalizedQuery.includes("boromir") || normalizedQuery.includes("faramir")) {
      return title.includes("boromir") || title.includes("faramir");
    }
    if (normalizedQuery.includes("merry") || normalizedQuery.includes("pippin")) {
      return title.includes("merry") || title.includes("pippin");
    }
    return normalizedQuery.split(" ").some((part) => part.length > 3 && title.includes(part));
  });
}

function zoneCards(state: GameState, playerId: PlayerId, zone: SearchZone): readonly string[] {
  const player = state.players[playerId];
  switch (zone) {
    case "draw":
    case "hand":
    case "cycle":
    case "reserve":
      return player[zone];
    case "inPlay":
      return [
        ...player.reserve,
        ...(state.activePath?.cards ?? []).filter((instanceId) => findOwner(state, instanceId) === playerId),
        ...(state.activeBattleground?.cards ?? []).filter((instanceId) => findOwner(state, instanceId) === playerId),
      ];
  }
}

function addActiveBattlegroundAttackTokens(state: GameState, count: number): GameState {
  if (count <= 0 || state.activeBattleground === null) {
    return state;
  }
  return {
    ...state,
    activeBattleground: {
      ...state.activeBattleground,
      attackTokens: state.activeBattleground.attackTokens + count,
    },
  };
}

function addActiveBattlegroundDefenseTokens(state: GameState, count: number): GameState {
  if (count <= 0 || state.activeBattleground === null) {
    return state;
  }
  return {
    ...state,
    activeBattleground: {
      ...state.activeBattleground,
      defenseTokens: state.activeBattleground.defenseTokens + count,
    },
  };
}

function violatesPlayRestriction(
  state: GameState,
  cardDef: CardDefinition,
  destination: PlayDestination,
): boolean {
  if (
    destination === "battleground" &&
    cardDef.id === "the-greatt-gate-37" &&
    state.activeBattleground !== null
  ) {
    return battlegroundById.get(state.activeBattleground.id)?.side === "shadow";
  }
  if (
    destination === "path" &&
    (cardDef.id === "mouth-of-sauron-154" || cardDef.id === "the-lidless-eye-156") &&
    state.activeBattleground !== null
  ) {
    return battlegroundById.get(state.activeBattleground.id)?.side === "shadow";
  }
  return false;
}

function hasExpandedBattlegroundAccess(
  state: GameState,
  cardDef: CardDefinition,
  battlegroundId: string,
): boolean {
  if (cardDef.id === "merry-brandybuck-70" && battlegroundHasFaction(battlegroundId, "rohan")) {
    return true;
  }
  if (cardDef.id === "pippin-took-71" && battlegroundHasFaction(battlegroundId, "dunedain")) {
    return true;
  }
  if (
    cardDef.faction === "rohan" &&
    (battlegroundHasFaction(battlegroundId, "dunedain") || battlegroundId === "minas-tirith") &&
    (isCardInPlay(state, "ghan-buri-ghan-84") || wasEventPlayedThisRound(state, "the-red-arrow-49"))
  ) {
    return true;
  }
  if (
    ["strider-44", "aragorn-38", "gimli-67", "legolas-56"].includes(cardDef.id) &&
    wasEventPlayedThisRound(state, "the-three-hunters-50")
  ) {
    return true;
  }
  return false;
}

function battlegroundHasFaction(battlegroundId: string, faction: Faction): boolean {
  const battleground = battlegroundById.get(battlegroundId);
  return battleground === undefined
    ? false
    : ([...battleground.attackingFactions, ...battleground.defendingFactions] as readonly Faction[])
        .includes(faction);
}

function wasEventPlayedThisRound(state: GameState, cardId: string): boolean {
  return state.roundMemory.playedCharacterOrItemCards.includes(cardId);
}

function isCardInPlay(state: GameState, cardId: string): boolean {
  return Object.keys(state.cards).some((instanceId) => {
    return getCard(state, instanceId).cardId === cardId && isInPlay(state, instanceId);
  });
}

function isAnyCardInPlay(state: GameState, cardIds: readonly string[]): boolean {
  return cardIds.some((cardId) => isCardInPlay(state, cardId));
}

function hobbitsOnActivePath(state: GameState): number {
  return (state.activePath?.cards ?? []).filter((instanceId) => {
    const card = getCardDefinition(getCard(state, instanceId).cardId);
    return card.type === "character" && card.faction === "hobbit";
  }).length;
}

function startRound(state: GameState): GameState {
  const side = getSideForRound(state.round);
  const battlegroundDeck = state.battlegroundDecks[side];
  const [battlegroundId, ...remainingBattlegrounds] = battlegroundDeck;
  const nextBattleground =
    battlegroundId === undefined
      ? null
      : {
          id: battlegroundId,
          cards: [],
          attackTokens: 0,
          defenseTokens: 0,
        } satisfies ActiveBattleground;

  const nextPathId =
    state.pathDeck.find((id) => pathById.get(id)?.pathNumber === state.currentPathNumber)
    ?? null;
  const nextPath =
    nextPathId === null
      ? null
      : ({
          id: nextPathId,
          cards: [],
          attackTokens: 0,
          defenseTokens: 0,
        } satisfies ActivePath);

  const nextPathDeck =
    nextPathId === null
      ? state.pathDeck
      : state.pathDeck.filter((id) => id !== nextPathId);

  return addLog(
    {
      ...state,
      phase: "action",
      activePlayer: turnOrder[(state.round - 1) % turnOrder.length] ?? "frodo",
      battlegroundDecks: {
        ...state.battlegroundDecks,
        [side]: remainingBattlegrounds,
      },
      pathDeck: nextPathDeck,
      activatedPaths:
        nextPathId === null || state.activatedPaths.includes(nextPathId)
          ? state.activatedPaths
          : [...state.activatedPaths, nextPathId],
      activeBattleground: nextBattleground,
      activePath: nextPath,
      roundMemory: { playedToReserve: [], playedCharacterOrItemCards: [] },
    },
    `Round ${state.round}: activated ${labelBattleground(nextBattleground)} and ${labelPath(
      nextPath,
    )}.`,
  );
}

function scoreBattleground(
  state: GameState,
  battleground: ActiveBattleground,
): GameState {
  const definition = battlegroundById.get(battleground.id);
  if (definition === undefined) {
    return state;
  }
  const attackFactions = new Set<Faction>(definition.attackingFactions);
  const attackingCards = battleground.cards.filter((instanceId) =>
    attackFactions.has(getCardDefinition(getCard(state, instanceId).cardId).faction),
  );
  const defendingCards = battleground.cards.filter(
    (instanceId) => !attackingCards.includes(instanceId),
  );
  const attack = attackingCards
    .reduce((sum, instanceId) => sum + battlegroundAttackFor(state, instanceId, battleground), 0);
  const defense =
    definition.defenseIcons +
    battleground.defenseTokens +
    defendingCards.reduce(
      (sum, instanceId) => sum + battlegroundDefenseFor(state, instanceId, battleground),
      0,
    );
  const winner: Side = attack > defense ? oppositeSide(definition.side) : definition.side;
  const locationDefense = definition.defenseIcons + battleground.defenseTokens;
  const remainingAttack = Math.max(0, attack - locationDefense);
  const { eliminated: defenderLosses, cycled: defenderSurvivors } =
    assignDefenderLosses(state, defendingCards, remainingAttack, "battleground");

  return addLog(
    cycleCards(
      eliminateCards(
        {
          ...state,
          score: {
            ...state.score,
            [winner]: state.score[winner] + definition.victoryPoints,
          },
          scoringAreas: {
            ...state.scoringAreas,
            battlegrounds: {
              ...state.scoringAreas.battlegrounds,
              [winner]: uniqueAppend(
                state.scoringAreas.battlegrounds[winner],
                definition.id,
              ),
            },
          },
        },
        [...attackingCards, ...defenderLosses],
        "battlegroundCombat",
      ),
      defenderSurvivors,
    ),
    `${definition.title}: ${winnerLabel(winner)} scored ${definition.victoryPoints} VP.`,
  );
}

function scorePath(state: GameState, path: ActivePath): GameState {
  const definition = pathById.get(path.id);
  if (definition === undefined) {
    return state;
  }
  const shadowCards = path.cards.filter((instanceId) => cardSide(state, instanceId) === "shadow");
  const freeCards = path.cards.filter((instanceId) => cardSide(state, instanceId) === "free");
  const attack = path.attackTokens + shadowCards
    .reduce((sum, instanceId) => sum + pathAttackFor(state, instanceId, path), 0);
  const locationDefense = definition.defenseIcons + path.defenseTokens + pathDefenseTokenBonus(state, path);
  const remainingAttack = Math.max(0, attack - locationDefense);
  const freeDefense = freeCards.reduce(
    (sum, instanceId) => sum + pathDefenseFor(state, instanceId, path),
    0,
  );
  const uncanceledAttack = Math.max(0, remainingAttack - freeDefense);
  const winner: Side = uncanceledAttack === 0 ? "free" : "shadow";
  const { eliminated: defenderLosses, cycled: defenderSurvivors } =
    assignDefenderLosses(state, freeCards, remainingAttack, "path");
  const points = winner === "free" ? definition.victoryPoints : uncanceledAttack;
  const corruptionAdded = winner === "shadow" ? uncanceledAttack : 0;

  return addLog(
    cycleCards(
      eliminateCards(
        {
          ...state,
          corruption: {
            tokens: state.corruption.tokens + corruptionAdded,
          },
          score: {
            ...state.score,
            [winner]: state.score[winner] + points,
          },
          scoringAreas: {
            ...state.scoringAreas,
            paths: {
              ...state.scoringAreas.paths,
              [winner]: appendScoredPath(state.scoringAreas.paths[winner], {
                id: definition.id,
                points,
                facedown: winner === "shadow",
              }),
            },
          },
        },
        [...shadowCards, ...defenderLosses],
        "pathCombat",
      ),
      defenderSurvivors,
    ),
    `${definition.title}: ${winnerLabel(winner)} scored ${points} VP.`,
  );
}

function executeDrawStep(state: GameState): GameState {
  const afterBaseDraw = turnOrder.reduce(
    (nextState, playerId) => drawCards(nextState, playerId, players[playerId].drawCount),
    state,
  );
  return turnOrder.reduce((nextState, playerId) => {
    return nextState.players[playerId].reserve.reduce((reserveState, instanceId) => {
      const cardId = getCard(reserveState, instanceId).cardId;
      return applyRuntimeCardScripts(reserveState, cardId, "whileInReserve", playerId);
    }, nextState);
  }, afterBaseDraw);
}

function drawCards(state: GameState, playerId: PlayerId, count: number): GameState {
  let nextState = state;
  for (let index = 0; index < count; index += 1) {
    const player = nextState.players[playerId];
    const replenished =
      player.draw.length === 0 && player.cycle.length > 0
        ? {
            ...player,
            draw: [...player.cycle],
            cycle: [],
          }
        : player;
    const [drawn, ...remainingDraw] = replenished.draw;
    if (drawn === undefined) {
      return nextState;
    }
    nextState = updatePlayer(nextState, playerId, () => ({
      ...replenished,
      draw: remainingDraw,
      hand: [...replenished.hand, drawn],
    }));
  }
  return nextState;
}

function forsakeFromTopOfDeck(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  const replenished =
    player.draw.length === 0 && player.cycle.length > 0
      ? {
          ...player,
          draw: [...player.cycle],
          cycle: [],
        }
      : player;
  const [forsaken, ...remainingDraw] = replenished.draw;
  if (forsaken === undefined) {
    return state;
  }
  const removedFromDraw = updatePlayer(state, playerId, () => ({
    ...replenished,
    draw: remainingDraw,
  }));
  return shouldCycleInstead(removedFromDraw, forsaken, "forsake")
    ? cycleCards(removedFromDraw, [forsaken])
    : eliminateCards(removedFromDraw, [forsaken], "forsake");
}

function eliminateCards(
  state: GameState,
  instanceIds: readonly string[],
  context: EliminationContext,
): GameState {
  const cardsToCycle = instanceIds.filter((instanceId) =>
    shouldCycleInstead(state, instanceId, context),
  );
  const cardsToEliminate = expandWithAttachedItems(
    state,
    instanceIds.filter((instanceId) => !cardsToCycle.includes(instanceId)),
  );
  const afterCycling = cycleCardsForReplacement(state, cardsToCycle, context);
  return cardsToEliminate.reduce((nextState, instanceId) => {
    const owner = findOwner(nextState, instanceId);
    if (owner === null) {
      return nextState;
    }
    return stripEmptyAttachmentLists(
      removeFromSharedPlayZones(
        updatePlayer(nextState, owner, (player) => ({
          ...player,
          reserve: removeOne(player.reserve, instanceId),
          hand: removeOne(player.hand, instanceId),
          draw: removeOne(player.draw, instanceId),
          cycle: removeOne(player.cycle, instanceId),
          eliminated: player.eliminated.includes(instanceId)
            ? player.eliminated
            : [...player.eliminated, instanceId],
        })),
        instanceId,
      ),
    );
  }, removeAttachmentLinks(afterCycling, cardsToEliminate));
}

function cycleCards(state: GameState, instanceIds: readonly string[]): GameState {
  const cardsToCycle = expandWithAttachedItems(state, instanceIds);
  return cardsToCycle.reduce((nextState, instanceId) => {
    const owner = findOwner(nextState, instanceId);
    if (owner === null) {
      return nextState;
    }
    return stripEmptyAttachmentLists(
      removeFromSharedPlayZones(
        updatePlayer(nextState, owner, (player) => ({
          ...player,
          reserve: removeOne(player.reserve, instanceId),
          hand: removeOne(player.hand, instanceId),
          draw: removeOne(player.draw, instanceId),
          eliminated: removeOne(player.eliminated, instanceId),
          cycle: player.cycle.includes(instanceId) ? player.cycle : [...player.cycle, instanceId],
        })),
        instanceId,
      ),
    );
  }, removeAttachmentLinks(state, cardsToCycle));
}

function expandWithAttachedItems(
  state: GameState,
  instanceIds: readonly string[],
): readonly string[] {
  const expanded: string[] = [];
  const visit = (instanceId: string): void => {
    if (expanded.includes(instanceId)) {
      return;
    }
    expanded.push(instanceId);
    for (const itemId of state.attachments[instanceId] ?? []) {
      visit(itemId);
    }
  };
  for (const instanceId of instanceIds) {
    visit(instanceId);
  }
  return expanded;
}

function removeAttachmentLinks(
  state: GameState,
  instanceIds: readonly string[],
): GameState {
  const removing = new Set(instanceIds);
  return {
    ...state,
    attachments: Object.fromEntries(
      Object.entries(state.attachments)
        .filter(([wielderId]) => !removing.has(wielderId))
        .map(([wielderId, itemIds]) => [
          wielderId,
          itemIds.filter((itemId) => !removing.has(itemId)),
        ]),
    ),
  };
}

function stripEmptyAttachmentLists(state: GameState): GameState {
  return {
    ...state,
    attachments: Object.fromEntries(
      Object.entries(state.attachments).filter(([, itemIds]) => itemIds.length > 0),
    ),
  };
}

function removeFromSharedPlayZones(state: GameState, instanceId: string): GameState {
  return {
    ...state,
    activeBattleground:
      state.activeBattleground === null
        ? null
        : {
            ...state.activeBattleground,
            cards: removeOne(state.activeBattleground.cards, instanceId),
          },
    activePath:
      state.activePath === null
        ? null
        : {
            ...state.activePath,
            cards: removeOne(state.activePath.cards, instanceId),
          },
  };
}

function removeScoredActivePathCards(state: GameState): GameState {
  if (state.activePath === null) {
    return state;
  }
  return {
    ...state,
    activePath: {
      ...state.activePath,
      cards: [],
    },
  };
}

function rememberCharacterOrItemPlayed(state: GameState, cardId: string): GameState {
  if (state.roundMemory.playedCharacterOrItemCards.includes(cardId)) {
    return state;
  }
  return {
    ...state,
    roundMemory: {
      ...state.roundMemory,
      playedCharacterOrItemCards: [
        ...state.roundMemory.playedCharacterOrItemCards,
        cardId,
      ],
    },
  };
}

function isValidWielder(
  state: GameState,
  itemDef: CardDefinition,
  wielderId: string,
): boolean {
  if (!isInPlay(state, wielderId)) {
    return false;
  }
  const wielder = state.cards[wielderId];
  if (wielder === undefined) {
    return false;
  }
  const wielderDef = getCardDefinition(wielder.cardId);
  return wielderDef.type === "character" && isAllowedWielderName(itemDef, wielderDef.title);
}

function isAllowedWielderName(itemDef: CardDefinition, wielderTitle: string): boolean {
  return itemDef.allowedWielders.some((allowed) => {
    const normalizedAllowed = normalizeName(allowed);
    const normalizedTitle = normalizeName(wielderTitle);
    return (
      normalizedAllowed === normalizedTitle ||
      normalizedTitle.includes(normalizedAllowed) ||
      normalizedAllowed.includes(normalizedTitle)
    );
  });
}

function isInPlay(state: GameState, instanceId: string): boolean {
  return (
    Object.values(state.players).some((player) => player.reserve.includes(instanceId)) ||
    (state.activeBattleground?.cards.includes(instanceId) ?? false) ||
    (state.activePath?.cards.includes(instanceId) ?? false)
  );
}

function carryoverLimit(state: GameState, playerId: PlayerId): number {
  const reserveBonus = state.players[playerId].reserve.reduce((bonus, instanceId) => {
    const implementation = getCardEffectImplementation(getCard(state, instanceId).cardId);
    return bonus + implementation.scripts
      .filter((script) => script.timing === "always")
      .flatMap((script) => script.instructions)
      .reduce(
        (sum, instruction) =>
          instruction.type === "modifyCarryover" ? sum + instruction.amount : sum,
        0,
      );
  }, 0);
  return baseCarryoverLimit + reserveBonus;
}

function enemyPlayers(playerId: PlayerId): readonly PlayerId[] {
  const side = players[playerId].side;
  return turnOrder.filter((candidate) => players[candidate].side !== side);
}

function validateActionTurn(state: GameState, playerId: PlayerId): RuleViolation | null {
  if (state.phase !== "action") {
    return {
      code: "wrong-phase",
      message: "This command can only be used during the action phase.",
    };
  }
  if (state.activePlayer !== playerId) {
    return {
      code: "wrong-player",
      message: "Only the active player can take an action.",
    };
  }
  return null;
}

function accepted(state: GameState, events: readonly GameEvent[]): CommandResult {
  return { ok: true, state: appendEvents(state, events), events };
}

function rejected(state: GameState, violation: RuleViolation): CommandResult {
  return { ok: false, state, violation };
}

function appendEvents(state: GameState, events: readonly GameEvent[]): GameState {
  if (events.length === 0) {
    return state;
  }
  return { ...state, eventLog: [...state.eventLog, ...events] };
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function assignDefenderLosses(
  state: GameState,
  defenderCards: readonly string[],
  attackToCancel: number,
  combatType: "battleground" | "path",
): { eliminated: readonly string[]; cycled: readonly string[] } {
  if (attackToCancel <= 0) {
    return { eliminated: [], cycled: defenderCards };
  }

  let canceled = 0;
  const eliminated: string[] = [];
  const sorted = [...defenderCards].sort((left, right) => {
    const leftDefense = defenseIconsFor(state, left, combatType);
    const rightDefense = defenseIconsFor(state, right, combatType);
    return leftDefense - rightDefense;
  });

  for (const instanceId of sorted) {
    if (canceled >= attackToCancel) {
      break;
    }
    eliminated.push(instanceId);
    canceled += defenseIconsFor(state, instanceId, combatType);
  }

  return {
    eliminated,
    cycled: defenderCards.filter((instanceId) => !eliminated.includes(instanceId)),
  };
}

function battlegroundAttackFor(
  state: GameState,
  instanceId: string,
  battleground: ActiveBattleground,
): number {
  const definition = getCardDefinition(getCard(state, instanceId).cardId);
  let value = definition.battlegroundAttack + definition.leadershipAttack;
  if (
    definition.id === "dead-man-of-dunharow-33" &&
    battleground.cards.some((cardId) =>
      ["strider-44", "aragorn-38"].includes(getCardDefinition(getCard(state, cardId).cardId).id),
    )
  ) {
    value += 2;
  }
  if (definition.id === "treebeard-ent-90" && battleground.id === "orthanc") {
    value += 1;
  }
  if (definition.id === "quickbeam-ent-91") {
    const isengardCount = battleground.cards.filter((cardId) => {
      const card = getCardDefinition(getCard(state, cardId).cardId);
      return card.faction === "isengard" && (card.type === "army" || card.type === "character");
    }).length;
    value += Math.floor(isengardCount / 2);
  }
  if (definition.id === "balrog-118" && battleground.id === "khazad-dum") {
    value += 1;
  }
  if (definition.id === "shelob-123" && battleground.id === "shelobs-lair") {
    value += 1;
  }
  return value;
}

function battlegroundDefenseFor(
  state: GameState,
  instanceId: string,
  battleground: ActiveBattleground,
): number {
  const definition = getCardDefinition(getCard(state, instanceId).cardId);
  let value = definition.battlegroundDefense + definition.leadershipDefense;
  if (
    definition.id === "dead-man-of-dunharow-33" &&
    battleground.cards.some((cardId) =>
      ["strider-44", "aragorn-38"].includes(getCardDefinition(getCard(state, cardId).cardId).id),
    )
  ) {
    value += 2;
  }
  if (definition.id === "knights-of-dol-amroth-34" && battleground.id === "dol-amroth") {
    value += 1;
  }
  if (definition.id === "guards-of-the-citadel-35" && battleground.id === "minas-tirith") {
    value += 1;
  }
  if (definition.id === "the-greatt-gate-37" && battleground.id === "minas-tirith") {
    value += 3;
  }
  if (definition.id === "theoden-85" && isAnyCardInPlay(state, ["gandalf-the-grey-88", "gandalf-the-white-89"])) {
    value += 1;
  }
  if (definition.id === "the-black-easterling-nazgul-149" && battleground.id === "dol-guldur") {
    value += 1;
  }
  if (definition.id === "coastal-raiders-126" && battleground.id === "dol-amroth") {
    value += 1;
  }
  if (definition.id === "haradrim-cavalry-127" && battleground.id === "minas-tirith") {
    value += 1;
  }
  if (definition.id === "the-black-fleet-128" && battleground.id === "pelargir") {
    value += 1;
  }
  return value;
}

function pathAttackFor(state: GameState, instanceId: string, path: ActivePath): number {
  const definition = getCardDefinition(getCard(state, instanceId).cardId);
  let value = definition.pathIcons;
  if (definition.id === "candles-of-corpses-121" && path.id === "dead-marshes") {
    value += 1;
  }
  return value;
}

function pathDefenseFor(state: GameState, instanceId: string, _path: ActivePath): number {
  return getCardDefinition(getCard(state, instanceId).cardId).pathIcons;
}

function pathDefenseTokenBonus(state: GameState, path: ActivePath): number {
  let bonus = 0;
  for (const [wielderId, itemIds] of Object.entries(state.attachments)) {
    if (!path.cards.includes(wielderId)) {
      continue;
    }
    if (
      itemIds.some((itemId) => getCard(state, itemId).cardId === "sting-76") &&
      path.cards.some((instanceId) => getCardDefinition(getCard(state, instanceId).cardId).faction === "monstrous")
    ) {
      bonus += 1;
    }
    if (itemIds.some((itemId) => getCard(state, itemId).cardId === "phial-of-galadriel-62")) {
      bonus += 2;
    }
  }
  return bonus;
}

function shouldCycleInstead(
  state: GameState,
  instanceId: string,
  context: EliminationContext,
): boolean {
  const cardId = getCard(state, instanceId).cardId;
  if (["frodo-baggins-69", "bilbo-baggins-73"].includes(cardId)) {
    return true;
  }
  if (cardId === "fatty-bolger-74" && context === "forsake") {
    return true;
  }
  if (
    context === "pathCombat" &&
    ["merry-brandybuck-70", "pippin-took-71", "smeagol-92", "gollum-122"].includes(cardId)
  ) {
    return true;
  }
  if (context === "battlegroundCombat" && cardId === "ioreth-45") {
    return true;
  }
  const attachedItemIds = state.attachments[instanceId] ?? [];
  if (
    context === "pathCombat" &&
    attachedItemIds.some((itemId) => getCard(state, itemId).cardId === "elven-cloak-58")
  ) {
    return true;
  }
  if (
    (context === "pathCombat" || context === "battlegroundCombat") &&
    attachedItemIds.some((itemId) => getCard(state, itemId).cardId === "nazguls-mantle-158")
  ) {
    return true;
  }
  if (
    (context === "pathCombat" || context === "battlegroundCombat") &&
    attachedItemIds.some((itemId) => getCard(state, itemId).cardId === "woven-of-all-colours-111")
  ) {
    return true;
  }
  return false;
}

function cycleCardsForReplacement(
  state: GameState,
  instanceIds: readonly string[],
  context: EliminationContext,
): GameState {
  return instanceIds.reduce((nextState, instanceId) => {
    const cardId = getCard(nextState, instanceId).cardId;
    const shouldEliminateAttachments =
      ["frodo-baggins-69", "bilbo-baggins-73"].includes(cardId) ||
      (cardId === "ioreth-45" && context === "battlegroundCombat");
    const attached = nextState.attachments[instanceId] ?? [];
    const cycled = shouldEliminateAttachments
      ? cycleCards(removeAttachmentLinks(nextState, attached), [instanceId])
      : cycleCards(nextState, [instanceId]);
    return shouldEliminateAttachments ? eliminateCards(cycled, attached, "effect") : cycled;
  }, state);
}

function defenseIconsFor(
  state: GameState,
  instanceId: string,
  combatType: "battleground" | "path",
): number {
  if (combatType === "path") {
    return state.activePath === null
      ? getCardDefinition(getCard(state, instanceId).cardId).pathIcons
      : pathDefenseFor(state, instanceId, state.activePath);
  }
  if (state.activeBattleground === null) {
    const definition = getCardDefinition(getCard(state, instanceId).cardId);
    return definition.battlegroundDefense + definition.leadershipDefense;
  }
  return battlegroundDefenseFor(state, instanceId, state.activeBattleground);
}

function cardSide(state: GameState, instanceId: string): Side {
  const definition = getCardDefinition(getCard(state, instanceId).cardId);
  return players[definition.owner].side;
}

function findOwner(state: GameState, instanceId: string): PlayerId | null {
  const stateOwner = turnOrder.find((playerId) => {
    const player = state.players[playerId];
    return (
      player.draw.includes(instanceId) ||
      player.hand.includes(instanceId) ||
      player.cycle.includes(instanceId) ||
      player.eliminated.includes(instanceId) ||
      player.reserve.includes(instanceId)
    );
  });
  if (stateOwner !== undefined) {
    return stateOwner;
  }

  const card = getCard(state, instanceId);
  const definition = getCardDefinition(card.cardId);
  return definition.owner;
}

function addLog(state: GameState, message: string): GameState {
  return {
    ...state,
    log: [...state.log, { id: state.log.length + 1, message }].slice(-80),
  };
}

function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: setPlayer(state.players, playerId, update(state.players[playerId])),
  };
}

function setPlayer(
  playersState: GameState["players"],
  playerId: PlayerId,
  player: PlayerState,
): GameState["players"] {
  return { ...playersState, [playerId]: player };
}

function mapPlayers(
  playersState: GameState["players"],
  update: (player: PlayerState) => PlayerState,
): GameState["players"] {
  return Object.fromEntries(
    turnOrder.map((playerId) => [playerId, update(playersState[playerId])]),
  ) as GameState["players"];
}

function removeOne(items: readonly string[], item: string): readonly string[] {
  const index = items.indexOf(item);
  if (index === -1) {
    return items;
  }
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

function uniqueAppend(items: readonly string[], item: string): readonly string[] {
  return items.includes(item) ? items : [...items, item];
}

function appendScoredPath(
  paths: GameState["scoringAreas"]["paths"][Side],
  path: GameState["scoringAreas"]["paths"][Side][number],
): GameState["scoringAreas"]["paths"][Side] {
  return paths.some((existing) => existing.id === path.id) ? paths : [...paths, path];
}

function nextPlayerId(playerId: PlayerId): PlayerId {
  const index = turnOrder.indexOf(playerId);
  return turnOrder[(index + 1) % turnOrder.length] ?? "frodo";
}

function copiesFor(_card: CardDefinition): number {
  return 1;
}

function shuffle<T>(items: readonly T[], rng: () => number): readonly T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = copy[index];
    const swap = copy[swapIndex];
    if (current === undefined || swap === undefined) {
      continue;
    }
    copy[index] = swap;
    copy[swapIndex] = current;
  }
  return copy;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function oppositeSide(side: Side): Side {
  return side === "free" ? "shadow" : "free";
}

function winnerLabel(side: Side): string {
  return side === "free" ? "Free Peoples" : "Shadow";
}

function labelBattleground(battleground: ActiveBattleground | null): string {
  if (battleground === null) {
    return "no battleground";
  }
  return battlegroundById.get(battleground.id)?.title ?? "unknown battleground";
}

function labelPath(path: ActivePath | null): string {
  if (path === null) {
    return "no path";
  }
  return pathById.get(path.id)?.title ?? "unknown path";
}

export function getBattlegroundDefinition(id: string) {
  return battlegroundById.get(id);
}

export function getPathDefinition(id: string) {
  return pathById.get(id);
}

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "setup":
      return "Setup";
    case "action":
      return "Action";
    case "combat":
      return "Combat";
    case "gameOver":
      return "Game over";
  }
}
