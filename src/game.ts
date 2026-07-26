import {
  battlegroundDefinitions,
  cardDefinitions,
  pathDefinitions,
  players,
  turnOrder,
} from "./data";
import type {
  ActiveBattleground,
  ActivePath,
  CardDefinition,
  CardInstance,
  CommandResult,
  DrawnCardPlayChoice,
  ForsakeChoice,
  ForsakeSource,
  Faction,
  GameEvent,
  GameState,
  PathActivationChoice,
  Phase,
  PendingDecision,
  PlayDestination,
  PlayerId,
  PlayerState,
  RuleViolation,
  Side,
  Zone,
} from "./types";

const startingHandSize = 7;
const setupCycleCount = 2;
const handLimit = 6;
const baseCarryoverLimit = 2;
const bowOfGaladhrimId = "bow-of-galadhrim-57";
const weaponCardIds = new Set([
  "anduril-46",
  "blade-of-westernesse-47",
  bowOfGaladhrimId,
  "dwarven-axe-68",
  "sting-76",
  "gandalfs-staff-94",
  "glamdring-95",
  "saruman-s-staff-110",
  "whip-of-many-thongs-124",
  "morgul-blade-162",
]);
const simpleLocationDraws: Readonly<
  Record<string, readonly (readonly [PlayerId, number])[]>
> = {
  "bag-end": [["frodo", 2]],
  "bucklebury-ferry": [["witchKing", 1], ["frodo", 1]],
  "inn-of-the-prancing-pony": [["witchKing", 2], ["saruman", 2]],
  weathertop: [["witchKing", 2]],
  "imladris-rivendel": [["aragorn", 2]],
  "the-council-of-elrond": [["frodo", 1], ["aragorn", 1]],
  "khazad-dum-moria": [["saruman", 2]],
  "dead-marshes": [["saruman", 2]],
  "the-cross-roads": [["frodo", 1], ["aragorn", 1]],
  "henneth-annun": [["aragorn", 1]],
  "shelob-s-lair": [["saruman", 2]],
  orodruin: [["witchKing", 2]],
  "crack-of-mount-doom": [["saruman", 2]],
  moria: [["saruman", 2]],
  harad: [["witchKing", 1], ["saruman", 1]],
  umbar: [["witchKing", 1], ["saruman", 1]],
};
const mandatoryLocationForsakes: Readonly<
  Record<
    string,
    readonly {
      readonly playerId: PlayerId;
      readonly drawAfterResolution?: number;
    }[]
  >
> = {
  "the-old-forest": [
    { playerId: "frodo" },
    { playerId: "aragorn" },
  ],
  "fords-of-bruinen": [
    { playerId: "frodo", drawAfterResolution: 3 },
    { playerId: "aragorn", drawAfterResolution: 3 },
  ],
  caradhras: [
    { playerId: "frodo" },
    { playerId: "aragorn" },
  ],
  "emyn-muil": [
    { playerId: "frodo" },
    { playerId: "aragorn" },
  ],
};
const optionalLocationForsakes: Readonly<
  Record<
    string,
    {
      readonly playerId: PlayerId;
      readonly drawAfterResolution?: number;
      readonly addPathAttackAfterResolution?: number;
    }
  >
> = {
  "the-doors-of-durin": {
    playerId: "saruman",
    addPathAttackAfterResolution: 1,
  },
  osgiliath: {
    playerId: "aragorn",
    drawAfterResolution: 3,
  },
  "minas-tirith": {
    playerId: "aragorn",
    drawAfterResolution: 3,
  },
  "dol-amroth": {
    playerId: "aragorn",
    drawAfterResolution: 1,
  },
  pelargir: {
    playerId: "aragorn",
    drawAfterResolution: 1,
  },
};
const locationDrawThenCycle: Readonly<
  Record<
    string,
    readonly {
      readonly playerId: PlayerId;
      readonly draw: number;
      readonly cycle: number;
    }[]
  >
> = {
  "gildors-encampment": [
    { playerId: "aragorn", draw: 1, cycle: 1 },
  ],
  egladil: [
    { playerId: "frodo", draw: 2, cycle: 1 },
    { playerId: "aragorn", draw: 2, cycle: 1 },
  ],
  "lothlorien-lorien": [
    { playerId: "aragorn", draw: 1, cycle: 1 },
  ],
  "amon-hen": [
    { playerId: "witchKing", draw: 1, cycle: 1 },
  ],
  rivendel: [
    { playerId: "aragorn", draw: 1, cycle: 1 },
  ],
};
const mandatoryLocationCycles: Readonly<
  Record<string, readonly { readonly playerId: PlayerId; readonly count: number }[]>
> = {
  "dimrill-dale": [
    { playerId: "witchKing", count: 2 },
    { playerId: "saruman", count: 2 },
  ],
};
const drawPlayCycleLocations: Readonly<
  Record<
    string,
    {
      readonly playerId: PlayerId;
      readonly playable: "army" | "character" | "nazgul" | "rohan-unit";
      readonly allowedDestinations?: readonly PlayDestination[];
    }
  >
> = {
  "morgul-vale": {
    playerId: "witchKing",
    playable: "nazgul",
  },
  "cirith-ungol": {
    playerId: "witchKing",
    playable: "army",
  },
  "helms-deep": {
    playerId: "frodo",
    playable: "rohan-unit",
    allowedDestinations: ["battleground"],
  },
  "minas-morgul": {
    playerId: "witchKing",
    playable: "nazgul",
    allowedDestinations: ["reserve"],
  },
  morannon: {
    playerId: "witchKing",
    playable: "army",
  },
};
const namedBattlegroundActivations: Readonly<Record<string, string>> = {
  edoras: "helms-deep",
  lorien: "dol-guldur",
  "dol-guldur": "lorien",
};

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
    pathDeck: shuffle(
      pathDefinitions.map((path) => path.id),
      rng,
    ),
    activatedPaths: [],
    activeBattleground: null,
    additionalActiveBattlegrounds: [],
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
    outcome: null,
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

export function canAttachItemTo(
  state: GameState,
  playerId: PlayerId,
  itemId: string,
  wielderId: string,
): boolean {
  const player = state.players[playerId];
  if (!player.hand.includes(itemId)) {
    return false;
  }
  const item = state.cards[itemId];
  if (item === undefined) {
    return false;
  }
  const itemDefinition = getCardDefinition(item.cardId);
  return (
    itemDefinition.type === "item" &&
    !state.roundMemory.playedCharacterOrItemCards.includes(itemDefinition.id) &&
    !Object.values(state.attachments).some((items) => items.includes(itemId)) &&
    isValidWielder(state, itemDefinition, wielderId)
  );
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
    eliminateCards(state, [firstCardId, secondCardId]),
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
    return forsakeChosenCard(state, instanceId, source);
  }
  if (
    source === "reserve" &&
    (player.reserve.includes(instanceId) ||
      controlledReserveItems(state, playerId).includes(instanceId))
  ) {
    return forsakeChosenCard(state, instanceId, source);
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

export function tryActivateBattlegroundFromDeck(
  state: GameState,
  battlegroundId: string,
): CommandResult {
  const battleground = battlegroundById.get(battlegroundId);
  if (battleground === undefined) {
    return rejected(state, {
      code: "unknown-battleground",
      message: `Battleground ${battlegroundId} is not defined.`,
      source: "reference:battlegrounds",
    });
  }
  const deckSide = (["free", "shadow"] as const).find((side) =>
    state.battlegroundDecks[side].includes(battlegroundId),
  );
  if (
    deckSide === undefined ||
    activeBattlegroundIds(state).includes(battlegroundId)
  ) {
    return rejected(state, {
      code: "battleground-not-available",
      message: "That battleground is not available in a battleground deck.",
      source: "rules:location-step",
    });
  }

  const remainingDeck = state.battlegroundDecks[deckSide].filter(
    (id) => id !== battlegroundId,
  );
  const nextState = applySimpleLocationActivationEffects(
    appendActiveBattleground(
    {
      ...state,
      battlegroundDecks: {
        ...state.battlegroundDecks,
        [deckSide]: shuffle(
          remainingDeck,
          mulberry32(
            hashSeed(
              `${state.seed}:battleground-search:${state.eventLog.length}:${battlegroundId}`,
            ),
          ),
        ),
      },
    },
    createActiveBattleground(battlegroundId),
    ),
    battlegroundId,
  );
  const activationEvent: GameEvent = {
    type: "battlegroundActivated",
    battlegroundId,
    reactivated: false,
    ignorePrintedDefense: false,
  };
  const finalState = appendEvents(
    addLog(nextState, `Activated ${battleground.title} from the ${deckSide} deck.`),
    [activationEvent],
  );
  return {
    ok: true,
    state: finalState,
    events: finalState.eventLog.slice(state.eventLog.length),
  };
}

export function tryReactivateBattleground(
  state: GameState,
  battlegroundId: string,
  activatingSide: Side,
): CommandResult {
  const battleground = battlegroundById.get(battlegroundId);
  if (battleground === undefined) {
    return rejected(state, {
      code: "unknown-battleground",
      message: `Battleground ${battlegroundId} is not defined.`,
      source: "reference:battlegrounds",
    });
  }
  const scoringSide = (["free", "shadow"] as const).find((side) =>
    state.scoringAreas.battlegrounds[side].includes(battlegroundId),
  );
  if (
    scoringSide === undefined ||
    activeBattlegroundIds(state).includes(battlegroundId)
  ) {
    return rejected(state, {
      code: "battleground-not-scored",
      message: "Only a battleground in a scoring area can be reactivated.",
      source: "rules:reactivation",
    });
  }

  const ignorePrintedDefense = scoringSide !== activatingSide;
  const nextState = applySimpleLocationActivationEffects(
    appendActiveBattleground(
    {
      ...state,
      scoringAreas: {
        ...state.scoringAreas,
        battlegrounds: {
          ...state.scoringAreas.battlegrounds,
          [scoringSide]: state.scoringAreas.battlegrounds[scoringSide].filter(
            (id) => id !== battlegroundId,
          ),
        },
      },
    },
    {
      ...createActiveBattleground(battlegroundId),
      ignorePrintedDefense,
    },
    ),
    battlegroundId,
  );
  const activationEvent: GameEvent = {
    type: "battlegroundActivated",
    battlegroundId,
    reactivated: true,
    ignorePrintedDefense,
  };
  const finalState = appendEvents(
    addLog(nextState, `Reactivated ${battleground.title} from the ${scoringSide} scoring area.`),
    [activationEvent],
  );
  return {
    ok: true,
    state: finalState,
    events: finalState.eventLog.slice(state.eventLog.length),
  };
}

export function activatePathById(state: GameState, pathId: string): GameState | null {
  const path = pathById.get(pathId);
  if (
    path === undefined ||
    state.activatedPaths.includes(pathId) ||
    !state.pathDeck.includes(pathId)
  ) {
    return null;
  }
  let nextState =
    state.activePath === null
      ? state
      : scorePath(state, state.activePath, {
          activatePathAfterResolution: pathId,
        });
  if (nextState.pendingDecisions.length > state.pendingDecisions.length) {
    return nextState;
  }
  nextState = removeScoredActivePathCards(nextState);
  return applySimpleLocationActivationEffects(
    addLog(
      {
      ...nextState,
      activePath: { id: pathId, cards: [], attackTokens: 0, defenseTokens: 0 },
      currentPathNumber: path.pathNumber,
      pathDeck: nextState.pathDeck.filter((id) => id !== pathId),
      activatedPaths: [...nextState.activatedPaths, pathId],
      },
      `Activated ${path.title}.`,
    ),
    pathId,
  );
}

export function tryActivatePathByChoice(
  state: GameState,
  pathId: string,
  choice: PathActivationChoice,
): CommandResult {
  const activePathId = state.activePath?.id;
  if (activePathId === undefined) {
    return rejected(state, {
      code: "no-active-path",
      message: "A path-choice effect requires an active path.",
      source: "rules:location-step",
    });
  }
  const activePath = pathById.get(activePathId);
  if (activePath === undefined) {
    return rejected(state, {
      code: "unknown-path",
      message: `The active path ${activePathId} is not defined.`,
      source: "reference:paths",
    });
  }
  if (!pathById.has(pathId)) {
    return rejected(state, {
      code: "unknown-path",
      message: `Path ${pathId} is not defined.`,
      source: "reference:paths",
    });
  }
  if (state.activatedPaths.includes(pathId)) {
    return rejected(state, {
      code: "path-already-activated",
      message: "A specific path cannot be activated more than once per game.",
      source: "rules:location-step",
    });
  }

  const requiredNumber =
    choice === "same-number"
      ? activePath.pathNumber
      : activePath.pathNumber + 1;
  const eligible = eligiblePathsByNumber(state, requiredNumber);
  if (eligible.length === 0) {
    return rejected(state, {
      code: "no-eligible-path",
      message: `No unactivated path ${requiredNumber} remains available.`,
      source: "rules:location-step",
    });
  }
  if (!eligible.includes(pathId)) {
    return rejected(state, {
      code: "path-not-eligible",
      message: `That path is not eligible for a ${choice} activation.`,
      source: "rules:location-step",
    });
  }

  const nextState = activatePathById(state, pathId);
  if (nextState === null) {
    return rejected(state, {
      code: "path-not-eligible",
      message: "That path is no longer available for activation.",
      source: "rules:location-step",
    });
  }
  if (nextState.activePath?.id !== pathId) {
    const events = nextState.eventLog.slice(state.eventLog.length);
    if (events.length === 0) {
      throw new Error("Deferred path activation must emit a pending-decision event.");
    }
    return { ok: true, state: nextState, events };
  }
  return accepted(nextState, [
    { type: "pathActivated", pathId, replacedPathId: activePathId },
  ]);
}

export function eligiblePathsByNumber(
  state: GameState,
  pathNumber: number,
): readonly string[] {
  return state.pathDeck.filter(
    (pathId) =>
      pathById.get(pathId)?.pathNumber === pathNumber &&
      !state.activatedPaths.includes(pathId),
  );
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

export function tryResolveForsakeDecision(
  state: GameState,
  playerId: PlayerId,
  choices: readonly ForsakeChoice[],
): CommandResult {
  const decision = state.pendingDecisions[0];
  if (decision === undefined) {
    return rejected(state, {
      code: "no-pending-decision",
      message: "There is no pending decision to resolve.",
    });
  }
  if (decision.type !== "forsake") {
    return rejected(state, {
      code: "wrong-decision-type",
      message: `The oldest pending decision is ${decision.type}, not forsake.`,
    });
  }
  if (decision.playerId !== playerId) {
    return rejected(state, {
      code: "wrong-decision-player",
      message: "Only the player named by the pending decision may resolve it.",
    });
  }

  const minimumChoices = Math.min(
    decision.minimum,
    availableForsakeCount(state, playerId),
  );
  const maximumChoices = Math.min(
    decision.maximum ?? decision.minimum,
    availableForsakeCount(state, playerId),
  );
  if (
    choices.length < minimumChoices ||
    choices.length > maximumChoices
  ) {
    return rejected(state, {
      code: "insufficient-decision-choices",
      message:
        minimumChoices === maximumChoices
          ? `This decision requires ${minimumChoices} forsake choice${minimumChoices === 1 ? "" : "s"}.`
          : `This decision allows between ${minimumChoices} and ${maximumChoices} forsake choices.`,
      ...(decision.source === undefined ? {} : { source: decision.source }),
    });
  }

  let nextState = state;
  const events: GameEvent[] = [];
  for (const choice of choices) {
    const cardId = choice.source === "draw" ? undefined : choice.cardId;
    const forsaken = forsakeCard(nextState, playerId, choice.source, cardId);
    if (forsaken === null || forsaken === nextState) {
      return rejected(state, {
        code: "invalid-decision-choice",
        message: "A selected card is not available from that forsake source.",
        ...(decision.source === undefined ? {} : { source: decision.source }),
      });
    }
    nextState = forsaken;
    events.push(
      cardId === undefined
        ? { type: "cardForsaken", playerId, source: choice.source }
        : { type: "cardForsaken", playerId, source: choice.source, cardId },
    );
  }

  if (
    choices.length > 0 &&
    decision.drawAfterResolution !== undefined
  ) {
    const handSize = nextState.players[playerId].hand.length;
    nextState = drawCards(
      nextState,
      playerId,
      decision.drawAfterResolution,
    );
    const drawn = nextState.players[playerId].hand.length - handSize;
    if (drawn > 0) {
      events.push({ type: "cardsDrawn", playerId, count: drawn });
    }
  }
  if (
    choices.length > 0 &&
    decision.addPathAttackAfterResolution !== undefined
  ) {
    nextState = addActivePathAttackTokens(
      nextState,
      decision.addPathAttackAfterResolution,
    );
  }
  nextState = resolveOldestPendingDecision(nextState);
  events.push({
    type: "pendingDecisionResolved",
    decisionType: decision.type,
    playerId,
  });
  return accepted(nextState, events);
}

export function tryResolveCycleFromHandDecision(
  state: GameState,
  playerId: PlayerId,
  selectedCards: readonly string[],
): CommandResult {
  const decision = state.pendingDecisions[0];
  if (decision === undefined) {
    return rejected(state, {
      code: "no-pending-decision",
      message: "There is no pending decision to resolve.",
    });
  }
  if (decision.type !== "cycleFromHand") {
    return rejected(state, {
      code: "wrong-decision-type",
      message: `The oldest pending decision is ${decision.type}, not cycle from hand.`,
    });
  }
  if (decision.playerId !== playerId) {
    return rejected(state, {
      code: "wrong-decision-player",
      message: "Only the player named by the pending decision may resolve it.",
    });
  }
  const hand = state.players[playerId].hand;
  const minimum = Math.min(decision.minimum, hand.length);
  const maximum = Math.min(decision.maximum, hand.length);
  if (
    selectedCards.length < minimum ||
    selectedCards.length > maximum ||
    new Set(selectedCards).size !== selectedCards.length ||
    selectedCards.some((cardId) => !hand.includes(cardId))
  ) {
    return rejected(state, {
      code: "invalid-decision-choice",
      message: `Select between ${minimum} and ${maximum} different cards from hand to cycle.`,
      ...(decision.source === undefined ? {} : { source: decision.source }),
    });
  }

  const nextState = resolveOldestPendingDecision(
    cycleCards(state, selectedCards),
  );
  return accepted(nextState, [
    ...selectedCards.map((cardId) => ({
      type: "cardCycled" as const,
      playerId,
      cardId,
    })),
    {
      type: "pendingDecisionResolved",
      decisionType: decision.type,
      playerId,
    },
  ]);
}

export function tryResolveSearchDecision(
  state: GameState,
  playerId: PlayerId,
  selectedCards: readonly string[],
): CommandResult {
  const decision = state.pendingDecisions[0];
  if (decision === undefined) {
    return rejected(state, {
      code: "no-pending-decision",
      message: "There is no pending decision to resolve.",
    });
  }
  if (decision.type !== "search") {
    return rejected(state, {
      code: "wrong-decision-type",
      message: `The oldest pending decision is ${decision.type}, not search.`,
    });
  }
  if (decision.playerId !== playerId) {
    return rejected(state, {
      code: "wrong-decision-player",
      message: "Only the player named by the pending decision may resolve it.",
    });
  }
  if (
    selectedCards.length < decision.minimum ||
    selectedCards.length > decision.maximum
  ) {
    return rejected(state, {
      code: "insufficient-decision-choices",
      message: `Select between ${decision.minimum} and ${decision.maximum} search results.`,
      ...(decision.source === undefined ? {} : { source: decision.source }),
    });
  }
  if (
    new Set(selectedCards).size !== selectedCards.length ||
    selectedCards.some(
      (instanceId) =>
        !decision.choices.includes(instanceId) ||
        !isCardInSearchZones(
          state,
          playerId,
          instanceId,
          decision.zones,
        ),
    )
  ) {
    return rejected(state, {
      code: "invalid-decision-choice",
      message: "Every selected card must be a distinct offered search result.",
      ...(decision.source === undefined ? {} : { source: decision.source }),
    });
  }

  const searchedDrawDeck = selectedCards.some((instanceId) =>
    state.players[playerId].draw.includes(instanceId),
  );
  let nextState = selectedCards.reduce(
    (current, instanceId) =>
      relocateCard(current, playerId, instanceId, decision.destination),
    state,
  );
  if (searchedDrawDeck && decision.recycleCycleAfterResolution !== true) {
    const player = nextState.players[playerId];
    nextState = updatePlayer(nextState, playerId, (current) => ({
      ...current,
      draw: shuffle(
        player.draw,
        mulberry32(
          hashSeed(
            `${state.seed}:search:${state.eventLog.length}:${playerId}`,
          ),
        ),
      ),
    }));
  }
  if (decision.recycleCycleAfterResolution === true) {
    const player = nextState.players[playerId];
    nextState = updatePlayer(nextState, playerId, (current) => ({
      ...current,
      draw: shuffle(
        [...player.draw, ...player.cycle],
        mulberry32(
          hashSeed(
            `${state.seed}:recycle:${state.eventLog.length}:${playerId}`,
          ),
        ),
      ),
      cycle: [],
    }));
  }
  nextState = resolveOldestPendingDecision(nextState);
  return accepted(nextState, [
    {
      type: "pendingDecisionResolved",
      decisionType: decision.type,
      playerId,
    },
  ]);
}

export function tryResolveDrawPlayCycleRestDecision(
  state: GameState,
  playerId: PlayerId,
  plays: readonly DrawnCardPlayChoice[],
): CommandResult {
  const decision = state.pendingDecisions[0];
  if (decision === undefined) {
    return rejected(state, {
      code: "no-pending-decision",
      message: "There is no pending decision to resolve.",
    });
  }
  if (decision.type !== "drawPlayCycleRest") {
    return rejected(state, {
      code: "wrong-decision-type",
      message: `The oldest pending decision is ${decision.type}, not draw/play/cycle-rest.`,
    });
  }
  if (decision.playerId !== playerId) {
    return rejected(state, {
      code: "wrong-decision-player",
      message: "Only the player named by the pending decision may resolve it.",
    });
  }
  const playedIds = plays.map((play) => play.cardId);
  if (
    plays.length > decision.maxPlays ||
    new Set(playedIds).size !== playedIds.length ||
    playedIds.some(
      (instanceId) =>
        !decision.drawnCards.includes(instanceId) ||
        !decision.playableCards.includes(instanceId),
    )
  ) {
    return rejected(state, {
      code: "invalid-decision-choice",
      message: "Selected plays must be distinct playable cards from this draw.",
      ...(decision.source === undefined ? {} : { source: decision.source }),
    });
  }
  if (
    decision.drawnCards.some(
      (instanceId) => !state.players[playerId].hand.includes(instanceId),
    )
  ) {
    return rejected(state, {
      code: "invalid-decision-choice",
      message: "Every unresolved drawn card must still be in the player's hand.",
      ...(decision.source === undefined ? {} : { source: decision.source }),
    });
  }

  let nextState = state;
  const events: GameEvent[] = [];
  for (const play of plays) {
    if (
      (decision.allowedDestinations !== undefined &&
        !decision.allowedDestinations.includes(play.destination)) ||
      !canPlayDrawnCardWithoutCost(nextState, playerId, play)
    ) {
      return rejected(state, {
        code: "invalid-destination",
        message: "A selected drawn card cannot be played to that destination.",
        ...(decision.source === undefined ? {} : { source: decision.source }),
      });
    }
    nextState = playDrawnCardWithoutCost(nextState, playerId, play);
    events.push({
      type: "cardPlayed",
      playerId,
      cardId: play.cardId,
      destination: play.destination,
    });
  }

  const cycledCards = decision.drawnCards.filter(
    (instanceId) => !playedIds.includes(instanceId),
  );
  nextState = cycleCards(nextState, cycledCards);
  nextState = resolveOldestPendingDecision(nextState);
  events.push({
    type: "pendingDecisionResolved",
    decisionType: decision.type,
    playerId,
  });
  return accepted(nextState, events);
}

export function tryResolveCombatLossDecision(
  state: GameState,
  selectedCards: readonly string[],
): CommandResult {
  const decision = state.pendingDecisions[0];
  if (decision === undefined) {
    return rejected(state, {
      code: "no-pending-decision",
      message: "There is no pending decision to resolve.",
    });
  }
  if (decision.type !== "combatLosses") {
    return rejected(state, {
      code: "wrong-decision-type",
      message: `The oldest pending decision is ${decision.type}, not combat losses.`,
    });
  }
  const activeLocation =
    decision.locationType === "path"
      ? state.activePath
      : state.activeBattleground;
  if (
    activeLocation?.id !== decision.locationId ||
    decision.candidates.some(
      (instanceId) => !activeLocation.cards.includes(instanceId),
    )
  ) {
    return rejected(state, {
      code: "invalid-decision-choice",
      message: "The combat-loss decision no longer matches the active location.",
      ...(decision.source === undefined ? {} : { source: decision.source }),
    });
  }

  const validSelections = validCombatLossSelections(state, decision);
  if (
    new Set(selectedCards).size !== selectedCards.length ||
    !validSelections.some((selection) => sameCardSet(selection, selectedCards))
  ) {
    return rejected(state, {
      code: "invalid-decision-choice",
      message: "Those defenders do not cancel as much attack as the rules require.",
      ...(decision.source === undefined ? {} : { source: decision.source }),
    });
  }

  const survivors = decision.candidates.filter(
    (instanceId) => !selectedCards.includes(instanceId),
  );
  let nextState = cycleCards(
    removeCombatCards(state, selectedCards, decision.locationType),
    survivors,
  );
  nextState = resolveOldestPendingDecision(nextState);
  const events: GameEvent[] = selectedCards.map((cardId) => ({
    type: hasCombatCycleReplacement(state, cardId, decision.locationType)
      ? "cardCycled"
      : "cardEliminated",
    playerId: getCardDefinition(getCard(state, cardId).cardId).owner,
    cardId,
  }));
  events.push({
    type: "pendingDecisionResolved",
    decisionType: decision.type,
  });
  nextState = appendEvents(nextState, events);
  if (
    decision.resumeCombat === true ||
    decision.activatePathAfterResolution !== undefined
  ) {
    nextState =
      decision.locationType === "path"
        ? { ...nextState, activePath: null }
        : advanceBattlegroundQueue(nextState);
  }
  const eventCountBeforeVictoryCheck = nextState.eventLog.length;
  nextState = applyEarlyVictory(nextState);
  if (nextState.phase === "gameOver") {
    events.push(
      ...nextState.eventLog.slice(eventCountBeforeVictoryCheck),
    );
    return { ok: true, state: nextState, events };
  }

  if (decision.activatePathAfterResolution !== undefined) {
    const pathId = decision.activatePathAfterResolution;
    const replacedPathId = decision.locationId;
    const activated = activatePathById(nextState, pathId);
    if (activated !== null) {
      const activationEvent: GameEvent = {
        type: "pathActivated",
        pathId,
        replacedPathId,
      };
      nextState = appendEvents(activated, [activationEvent]);
      events.push(activationEvent);
    }
  } else if (decision.resumeCombat === true) {
    nextState = resolveCombat(nextState);
  }
  return { ok: true, state: nextState, events };
}

export function legalCombatLossSelections(
  state: GameState,
): readonly (readonly string[])[] {
  const decision = state.pendingDecisions[0];
  return decision?.type === "combatLosses"
    ? validCombatLossSelections(state, decision)
    : [];
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
    if (nextState.pendingDecisions.length > state.pendingDecisions.length) {
      return nextState;
    }
    nextState = advanceBattlegroundQueue(nextState);
    nextState = applyEarlyVictory(nextState);
    if (nextState.phase === "gameOver") {
      return nextState;
    }
    if (nextState.activeBattleground !== null) {
      return resolveCombat(nextState);
    }
  }

  const path = nextState.activePath;
  if (path !== null) {
    const pendingCount = nextState.pendingDecisions.length;
    nextState = scorePath(nextState, path, { resumeCombat: true });
    if (nextState.pendingDecisions.length > pendingCount) {
      return nextState;
    }
    nextState = { ...nextState, activePath: null };
    nextState = applyEarlyVictory(nextState);
    if (nextState.phase === "gameOver") {
      return nextState;
    }
  }

  if (nextState.currentPathNumber >= 9) {
    const finalState = scoreUnusedRingTokens(nextState);
    return finishGame(finalState, finalWinner(finalState), "final-scoring");
  }

  nextState = executeDrawStep(nextState);
  return startRound({
    ...nextState,
    phase: "action",
    round: nextState.round + 1,
    currentPathNumber: nextState.currentPathNumber + 1,
    activeBattleground: null,
    additionalActiveBattlegrounds: [],
    activePath: null,
    players: mapPlayers(nextState.players, (player) => ({
      ...player,
      passed: false,
    })),
  });
}

function applyEarlyVictory(state: GameState): GameState {
  const gap = state.score.free - state.score.shadow;
  if (Math.abs(gap) < 10) {
    return state;
  }
  return finishGame(
    state,
    gap > 0 ? "free" : "shadow",
    "early-score-gap",
  );
}

function finalWinner(state: GameState): Side {
  return state.score.free > state.score.shadow ? "free" : "shadow";
}

function scoreUnusedRingTokens(state: GameState): GameState {
  const points: Record<Side, number> = { free: 0, shadow: 0 };
  for (const playerId of turnOrder) {
    if (!state.players[playerId].usedRingToken) {
      points[players[playerId].side] += 1;
    }
  }
  return {
    ...state,
    score: {
      free: state.score.free + points.free,
      shadow: state.score.shadow + points.shadow,
    },
    eventLog: [
      ...state.eventLog,
      { type: "unusedRingTokensScored", points },
    ],
  };
}

function finishGame(
  state: GameState,
  winner: Side,
  reason: "early-score-gap" | "final-scoring",
): GameState {
  if (state.outcome !== null) {
    return state;
  }
  const outcome = {
    winner,
    reason,
    finalScore: state.score,
  } as const;
  return addLog(
    {
      ...state,
      phase: "gameOver",
      outcome,
      eventLog: [
        ...state.eventLog,
        { type: "gameEnded", outcome },
      ],
    },
    `${winnerLabel(winner)} won ${state.score.free}-${state.score.shadow} (${reason}).`,
  );
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
    ...state.additionalActiveBattlegrounds.map(
      (battleground) => battleground.cards,
    ),
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
  for (const battleground of state.additionalActiveBattlegrounds) {
    if (!battlegroundById.has(battleground.id)) {
      errors.push(`Unknown additional active battleground: ${battleground.id}`);
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
      if (!isAllowedWielder(itemDef, wielderDef)) {
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
  if (destination === "reserve") {
    return cardDef.type === "army" || cardDef.type === "character";
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
    return playableFactions.includes(cardDef.faction);
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
  return playableFactions.includes(cardDef.faction);
}

function startRound(state: GameState): GameState {
  const startingSide = getSideForRound(state.round);
  const fallbackSide = oppositeSide(startingSide);
  const battlegroundSide =
    state.battlegroundDecks[startingSide].length > 0
      ? startingSide
      : state.battlegroundDecks[fallbackSide].length > 0
        ? fallbackSide
        : null;
  const battlegroundId =
    battlegroundSide === null
      ? undefined
      : state.battlegroundDecks[battlegroundSide][0];
  const nextBattleground =
    battlegroundId === undefined
      ? null
      : {
          id: battlegroundId,
          cards: [],
          attackTokens: 0,
          defenseTokens: 0,
        } satisfies ActiveBattleground;
  const nextBattlegroundDecks =
    battlegroundSide === null
      ? state.battlegroundDecks
      : {
          ...state.battlegroundDecks,
          [battlegroundSide]: state.battlegroundDecks[battlegroundSide].slice(1),
        };

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

  const nextState: GameState = {
      ...state,
      phase: "action",
      activePlayer: turnOrder[(state.round - 1) % turnOrder.length] ?? "frodo",
      battlegroundDecks: nextBattlegroundDecks,
      pathDeck: nextPathDeck,
      activatedPaths:
        nextPathId === null || state.activatedPaths.includes(nextPathId)
          ? state.activatedPaths
          : [...state.activatedPaths, nextPathId],
      activeBattleground: nextBattleground,
      additionalActiveBattlegrounds: [],
      activePath: nextPath,
      roundMemory: { playedToReserve: [], playedCharacterOrItemCards: [] },
      eventLog: [
        ...state.eventLog,
        {
          type: "roundStarted",
          round: state.round,
          pathId: nextPathId,
          battlegroundId: battlegroundId ?? null,
        },
      ],
    };

  const withBattlegroundEffects =
    battlegroundId === undefined
      ? nextState
      : applySimpleLocationActivationEffects(
          nextState,
          battlegroundId,
        );
  const withLocationEffects =
    nextPathId === null
      ? withBattlegroundEffects
      : applySimpleLocationActivationEffects(
          withBattlegroundEffects,
          nextPathId,
        );
  return addLog(
    withLocationEffects,
    `Round ${state.round}: activated ${labelBattleground(nextBattleground)} and ${labelPath(
      nextPath,
    )}.`,
  );
}

function applySimpleLocationActivationEffects(
  state: GameState,
  locationId: string,
): GameState {
  let nextState = state;
  for (const [playerId, count] of simpleLocationDraws[locationId] ?? []) {
    const handSize = nextState.players[playerId].hand.length;
    nextState = drawCards(nextState, playerId, count);
    const drawn = nextState.players[playerId].hand.length - handSize;
    if (drawn > 0) {
      nextState = appendEvents(nextState, [
        { type: "cardsDrawn", playerId, count: drawn },
      ]);
    }
  }
  for (const effect of locationDrawThenCycle[locationId] ?? []) {
    const handSize = nextState.players[effect.playerId].hand.length;
    nextState = drawCards(nextState, effect.playerId, effect.draw);
    const drawn =
      nextState.players[effect.playerId].hand.length - handSize;
    if (drawn > 0) {
      nextState = appendEvents(nextState, [
        {
          type: "cardsDrawn",
          playerId: effect.playerId,
          count: drawn,
        },
      ]);
    }
    nextState = enqueuePendingDecision(nextState, {
      type: "cycleFromHand",
      playerId: effect.playerId,
      minimum: effect.cycle,
      maximum: effect.cycle,
      reason: `${locationId} activation`,
      source: `location:${locationId}`,
    });
  }
  for (const effect of mandatoryLocationCycles[locationId] ?? []) {
    nextState = enqueuePendingDecision(nextState, {
      type: "cycleFromHand",
      playerId: effect.playerId,
      minimum: effect.count,
      maximum: effect.count,
      reason: `${locationId} activation`,
      source: `location:${locationId}`,
    });
  }
  const drawPlayCycle = drawPlayCycleLocations[locationId];
  if (drawPlayCycle !== undefined) {
    const handSize =
      nextState.players[drawPlayCycle.playerId].hand.length;
    nextState = drawCards(nextState, drawPlayCycle.playerId, 5);
    const drawnCards =
      nextState.players[drawPlayCycle.playerId].hand.slice(handSize);
    const playableCards = drawnCards.filter((instanceId) => {
      const card = getCardDefinition(getCard(nextState, instanceId).cardId);
      switch (drawPlayCycle.playable) {
        case "army":
          return card.type === "army";
        case "character":
          return card.type === "character";
        case "nazgul":
          return (
            card.type === "character" &&
            normalizeName(card.title).includes("nazgul")
          );
        case "rohan-unit":
          return (
            card.faction === "rohan" &&
            (card.type === "army" || card.type === "character")
          );
      }
    });
    if (drawnCards.length > 0) {
      nextState = appendEvents(nextState, [
        {
          type: "cardsDrawn",
          playerId: drawPlayCycle.playerId,
          count: drawnCards.length,
        },
      ]);
    }
    nextState = enqueuePendingDecision(nextState, {
      type: "drawPlayCycleRest",
      playerId: drawPlayCycle.playerId,
      drawnCards,
      playableCards,
      maxPlays: 1,
      ...(drawPlayCycle.allowedDestinations === undefined
        ? {}
        : {
            allowedDestinations:
              drawPlayCycle.allowedDestinations,
          }),
      source: `location:${locationId}`,
    });
  }
  if (locationId === "morgai" && nextState.activePath?.id === locationId) {
    nextState = addActivePathAttackTokens(nextState, 1);
  }
  for (const forsake of mandatoryLocationForsakes[locationId] ?? []) {
    nextState = enqueuePendingDecision(nextState, {
      type: "forsake",
      playerId: forsake.playerId,
      minimum: 1,
      reason: `${locationId} activation`,
      ...(forsake.drawAfterResolution === undefined
        ? {}
        : { drawAfterResolution: forsake.drawAfterResolution }),
      source: `location:${locationId}`,
    });
  }
  const optionalForsake = optionalLocationForsakes[locationId];
  if (optionalForsake !== undefined) {
    nextState = enqueuePendingDecision(nextState, {
      type: "forsake",
      playerId: optionalForsake.playerId,
      minimum: 0,
      maximum: 1,
      reason: `${locationId} optional activation effect`,
      ...(optionalForsake.drawAfterResolution === undefined
        ? {}
        : { drawAfterResolution: optionalForsake.drawAfterResolution }),
      ...(optionalForsake.addPathAttackAfterResolution === undefined
        ? {}
        : {
            addPathAttackAfterResolution:
              optionalForsake.addPathAttackAfterResolution,
          }),
      source: `location:${locationId}`,
    });
  }
  if (locationId === "orthanc") {
    const sarumanChoices = [
      ...nextState.players.saruman.draw,
      ...nextState.players.saruman.cycle,
    ].filter(
      (instanceId) =>
        normalizeName(
          getCardDefinition(getCard(nextState, instanceId).cardId).title,
        ) === "saruman",
    );
    nextState = enqueuePendingDecision(nextState, {
      type: "search",
      playerId: "saruman",
      zones: ["draw", "cycle"],
      choices: sarumanChoices,
      minimum: 0,
      maximum: Math.min(1, sarumanChoices.length),
      destination: "hand",
      recycleCycleAfterResolution: true,
      source: "location:orthanc",
    });
  }
  const namedBattleground = namedBattlegroundActivations[locationId];
  if (namedBattleground !== undefined) {
    nextState = applyNamedBattlegroundActivation(
      nextState,
      locationId,
      namedBattleground,
    );
  }
  return nextState;
}

function applyNamedBattlegroundActivation(
  state: GameState,
  sourceId: string,
  targetId: string,
): GameState {
  if (activeBattlegroundIds(state).includes(targetId)) {
    return state;
  }
  const fromDeck = tryActivateBattlegroundFromDeck(state, targetId);
  if (fromDeck.ok) {
    return fromDeck.state;
  }
  const sourceSide = battlegroundById.get(sourceId)?.side;
  if (sourceSide === undefined) {
    return state;
  }
  const fromScoringArea = tryReactivateBattleground(
    state,
    targetId,
    sourceSide,
  );
  return fromScoringArea.ok ? fromScoringArea.state : state;
}

function createActiveBattleground(
  battlegroundId: string,
): ActiveBattleground {
  return {
    id: battlegroundId,
    cards: [],
    attackTokens: 0,
    defenseTokens: 0,
    ignorePrintedDefense: false,
  };
}

function appendActiveBattleground(
  state: GameState,
  battleground: ActiveBattleground,
): GameState {
  if (state.activeBattleground === null) {
    return { ...state, activeBattleground: battleground };
  }
  return {
    ...state,
    additionalActiveBattlegrounds: [
      ...state.additionalActiveBattlegrounds,
      battleground,
    ],
  };
}

function activeBattlegroundIds(state: GameState): readonly string[] {
  return [
    ...(state.activeBattleground === null
      ? []
      : [state.activeBattleground.id]),
    ...state.additionalActiveBattlegrounds.map(
      (battleground) => battleground.id,
    ),
  ];
}

function advanceBattlegroundQueue(state: GameState): GameState {
  const [nextBattleground, ...remainingBattlegrounds] =
    state.additionalActiveBattlegrounds;
  return {
    ...state,
    activeBattleground: nextBattleground ?? null,
    additionalActiveBattlegrounds: remainingBattlegrounds,
  };
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
  const attack = battleground.attackTokens + attackingCards
    .reduce(
      (sum, instanceId) =>
        sum + combatIconsFor(state, instanceId, "battleground-attack"),
      0,
    );
  const printedDefense = battleground.ignorePrintedDefense === true
    ? 0
    : definition.defenseIcons;
  const defense =
    printedDefense +
    battleground.defenseTokens +
    defendingCards
      .reduce(
        (sum, instanceId) =>
          sum + combatIconsFor(state, instanceId, "battleground-defense"),
        0,
      );
  const winner: Side = attack > defense ? oppositeSide(definition.side) : definition.side;
  const locationDefense = printedDefense + battleground.defenseTokens;
  const remainingAttack = Math.max(0, attack - locationDefense);
  const decision = {
    type: "combatLosses",
    side: definition.side,
    locationType: "battleground",
    locationId: definition.id,
    attackToCancel: remainingAttack,
    candidates: defendingCards,
    resumeCombat: true,
    source: "combat:battleground",
  } satisfies Extract<PendingDecision, { readonly type: "combatLosses" }>;
  const validSelections = validCombatLossSelections(state, decision);
  const scoredState: GameState = {
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
  };
  if (validSelections.length > 1) {
    return addLog(
      enqueuePendingDecision(
        removeCombatCards(scoredState, attackingCards, "battleground"),
        decision,
      ),
      `${definition.title}: ${winnerLabel(winner)} scored ${definition.victoryPoints} VP; awaiting defender losses.`,
    );
  }
  const defenderLosses = validSelections[0] ?? [];
  const defenderSurvivors = defendingCards.filter(
    (instanceId) => !defenderLosses.includes(instanceId),
  );

  return addLog(
    cycleCards(
      removeCombatCards(
        scoredState,
        [...attackingCards, ...defenderLosses],
        "battleground",
      ),
      defenderSurvivors,
    ),
    `${definition.title}: ${winnerLabel(winner)} scored ${definition.victoryPoints} VP.`,
  );
}

function scorePath(
  state: GameState,
  path: ActivePath,
  continuation: {
    readonly resumeCombat?: boolean;
    readonly activatePathAfterResolution?: string;
  } = {},
): GameState {
  const definition = pathById.get(path.id);
  if (definition === undefined) {
    return state;
  }
  const shadowCards = path.cards.filter((instanceId) => cardSide(state, instanceId) === "shadow");
  const freeCards = path.cards.filter((instanceId) => cardSide(state, instanceId) === "free");
  const attack = path.attackTokens + shadowCards
    .reduce(
      (sum, instanceId) => sum + combatIconsFor(state, instanceId, "path"),
      0,
    );
  const locationDefense = definition.defenseIcons + path.defenseTokens;
  const remainingAttack = Math.max(0, attack - locationDefense);
  const freeDefense = freeCards
    .reduce(
      (sum, instanceId) => sum + combatIconsFor(state, instanceId, "path"),
      0,
    );
  const uncanceledAttack = Math.max(0, remainingAttack - freeDefense);
  const winner: Side = uncanceledAttack === 0 ? "free" : "shadow";
  const points = winner === "free" ? definition.victoryPoints : uncanceledAttack;
  const corruptionAdded = winner === "shadow" ? uncanceledAttack : 0;
  const decision = {
    type: "combatLosses",
    side: "free",
    locationType: "path",
    locationId: definition.id,
    attackToCancel: remainingAttack,
    candidates: freeCards,
    ...continuation,
    source: "combat:path",
  } satisfies Extract<PendingDecision, { readonly type: "combatLosses" }>;
  const validSelections = validCombatLossSelections(state, decision);
  const scoredState: GameState = {
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
  };
  if (validSelections.length > 1) {
    return addLog(
      enqueuePendingDecision(
        removeCombatCards(scoredState, shadowCards, "path"),
        decision,
      ),
      `${definition.title}: ${winnerLabel(winner)} scored ${points} VP; awaiting defender losses.`,
    );
  }
  const defenderLosses = validSelections[0] ?? [];
  const defenderSurvivors = freeCards.filter(
    (instanceId) => !defenderLosses.includes(instanceId),
  );

  return addLog(
    cycleCards(
      removeCombatCards(
        scoredState,
        [...shadowCards, ...defenderLosses],
        "path",
      ),
      defenderSurvivors,
    ),
    `${definition.title}: ${winnerLabel(winner)} scored ${points} VP.`,
  );
}

function executeDrawStep(state: GameState): GameState {
  return turnOrder.reduce(
    (nextState, playerId) =>
      drawCards(nextState, playerId, drawCountForPlayer(nextState, playerId)),
    state,
  );
}

export function drawCountForPlayer(
  state: GameState,
  playerId: PlayerId,
): number {
  const reserveBonus = state.players[playerId].reserve.filter((instanceId) => {
    const text = normalizeName(
      getCardDefinition(getCard(state, instanceId).cardId).text,
    );
    return text.includes("while in reserve draw 1");
  }).length;
  return players[playerId].drawCount + reserveBonus;
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
  const withoutTopCard = updatePlayer(state, playerId, () => ({
    ...replenished,
    draw: remainingDraw,
  }));
  const definition = getCardDefinition(getCard(state, forsaken).cardId);
  const normalizedText = normalizeName(definition.text);
  const cyclesInstead =
    normalizedText.includes("forsaken from top of the draw deck cycle instead") ||
    normalizedText.includes("eliminated or forsaken cycle instead") ||
    normalizedText.includes("eliminated or being forsaken cycle instead");
  return cyclesInstead
    ? cycleCards(withoutTopCard, [forsaken])
    : eliminateCards(withoutTopCard, [forsaken]);
}

function eliminateCards(state: GameState, instanceIds: readonly string[]): GameState {
  return instanceIds.reduce((nextState, instanceId) => {
    if (!hasGeneralEliminationCycleReplacement(nextState, instanceId)) {
      return eliminateCardsWithoutReplacement(nextState, [instanceId]);
    }
    const text = normalizedCardText(nextState, instanceId);
    if (text.includes("any wielded items are eliminated")) {
      const attachedItems = nextState.attachments[instanceId] ?? [];
      return cycleCards(
        eliminateCardsWithoutReplacement(nextState, attachedItems),
        [instanceId],
      );
    }
    return cycleCards(nextState, [instanceId]);
  }, state);
}

function eliminateCardsWithoutReplacement(
  state: GameState,
  instanceIds: readonly string[],
): GameState {
  const cardsToEliminate = expandWithAttachedItems(state, instanceIds);
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
  }, removeAttachmentLinks(state, cardsToEliminate));
}

function forsakeChosenCard(
  state: GameState,
  instanceId: string,
  source: "hand" | "reserve",
): GameState {
  const text = normalizedCardText(state, instanceId);
  const reserveForsakeReplacement =
    source === "reserve" &&
    text.includes("if in reserve and when forsaken cycle instead");
  return reserveForsakeReplacement
    ? cycleCards(state, [instanceId])
    : eliminateCards(state, [instanceId]);
}

function hasGeneralEliminationCycleReplacement(
  state: GameState,
  instanceId: string,
): boolean {
  const text = normalizedCardText(state, instanceId);
  return (
    text.includes("eliminated or being forsaken cycle instead") ||
    text.includes("eliminated or forsaken cycle instead")
  );
}

function normalizedCardText(state: GameState, instanceId: string): string {
  return normalizeName(
    getCardDefinition(getCard(state, instanceId).cardId).text,
  );
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

function removeCombatCards(
  state: GameState,
  instanceIds: readonly string[],
  combatType: "battleground" | "path",
): GameState {
  return instanceIds.reduce((nextState, instanceId) => {
    if (!hasCombatCycleReplacement(nextState, instanceId, combatType)) {
      return eliminateCards(nextState, [instanceId]);
    }
    const ownText = normalizeName(
      getCardDefinition(getCard(nextState, instanceId).cardId).text,
    );
    const attachmentProvidesReplacement = (
      nextState.attachments[instanceId] ?? []
    ).some((itemId) =>
      hasCombatCycleReplacement(nextState, itemId, combatType)
    );
    if (
      ownText.includes("any wielded items are eliminated") &&
      !attachmentProvidesReplacement
    ) {
      const attachedItems = nextState.attachments[instanceId] ?? [];
      return cycleCards(
        eliminateCards(nextState, attachedItems),
        [instanceId],
      );
    }
    return cycleCards(nextState, [instanceId]);
  }, state);
}

function hasCombatCycleReplacement(
  state: GameState,
  instanceId: string,
  combatType: "battleground" | "path",
): boolean {
  return expandWithAttachedItems(state, [instanceId]).some((cardId) => {
    const text = normalizeName(
      getCardDefinition(getCard(state, cardId).cardId).text,
    );
    return (
      ((text.includes("eliminated in combat") ||
        (combatType === "path" &&
          text.includes("eliminated in path combat"))) &&
        text.includes("cycle") &&
        text.includes("instead")) ||
      text.includes("eliminated or being forsaken cycle instead")
    );
  });
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
    additionalActiveBattlegrounds: state.additionalActiveBattlegrounds.map(
      (battleground) => ({
        ...battleground,
        cards: removeOne(battleground.cards, instanceId),
      }),
    ),
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
  return (
    wielderDef.type === "character" &&
    isAllowedWielder(itemDef, wielderDef) &&
    !violatesWeaponRestriction(state, itemDef, wielderId)
  );
}

function violatesWeaponRestriction(
  state: GameState,
  itemDef: CardDefinition,
  wielderId: string,
): boolean {
  const attachedDefinitions = (state.attachments[wielderId] ?? []).map(
    (itemId) => getCardDefinition(getCard(state, itemId).cardId),
  );
  const bowAlreadyAttached = attachedDefinitions.some(
    (definition) => definition.id === bowOfGaladhrimId,
  );
  const weaponAlreadyAttached = attachedDefinitions.some((definition) =>
    weaponCardIds.has(definition.id)
  );
  return (
    (bowAlreadyAttached && weaponCardIds.has(itemDef.id)) ||
    (itemDef.id === bowOfGaladhrimId && weaponAlreadyAttached)
  );
}

function isAllowedWielder(
  itemDef: CardDefinition,
  wielderDef: CardDefinition,
): boolean {
  return itemDef.allowedWielders.some((allowed) => {
    const normalizedAllowed = normalizeName(allowed);
    const normalizedTitle = normalizeName(wielderDef.title);
    const normalizedFaction = normalizeName(wielderDef.faction);
    return (
      normalizedAllowed === normalizedTitle ||
      normalizedAllowed === normalizedFaction ||
      normalizedTitle.includes(normalizedAllowed) ||
      normalizedAllowed.includes(normalizedTitle)
    );
  });
}

function isInPlay(state: GameState, instanceId: string): boolean {
  return isInPlayWithoutAttachmentCycle(state, instanceId, new Set());
}

function isInPlayWithoutAttachmentCycle(
  state: GameState,
  instanceId: string,
  visited: ReadonlySet<string>,
): boolean {
  if (visited.has(instanceId)) {
    return false;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(instanceId);
  return (
    Object.values(state.players).some((player) => player.reserve.includes(instanceId)) ||
    (state.activeBattleground?.cards.includes(instanceId) ?? false) ||
    state.additionalActiveBattlegrounds.some((battleground) =>
      battleground.cards.includes(instanceId)
    ) ||
    (state.activePath?.cards.includes(instanceId) ?? false) ||
    Object.entries(state.attachments).some(
      ([wielderId, itemIds]) =>
        itemIds.includes(instanceId) &&
        isInPlayWithoutAttachmentCycle(state, wielderId, nextVisited),
    )
  );
}

function carryoverLimit(state: GameState, playerId: PlayerId): number {
  const modifiers = Object.keys(state.cards).filter((instanceId) => {
    if (findOwner(state, instanceId) !== playerId || !isInPlay(state, instanceId)) {
      return false;
    }
    const text = normalizeName(
      getCardDefinition(getCard(state, instanceId).cardId).text,
    );
    return text.includes("increase your carryover limit by 1");
  }).length;
  return baseCarryoverLimit + modifiers;
}

function enemyPlayers(playerId: PlayerId): readonly PlayerId[] {
  const side = players[playerId].side;
  return turnOrder.filter((candidate) => players[candidate].side !== side);
}

function validateActionTurn(state: GameState, playerId: PlayerId): RuleViolation | null {
  if (state.pendingDecisions.length > 0) {
    return {
      code: "pending-decision-required",
      message: "Resolve the oldest pending decision before taking another action.",
    };
  }
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

function isCardInSearchZones(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  zones: readonly Zone[],
): boolean {
  if (findOwner(state, instanceId) !== playerId) {
    return false;
  }
  const player = state.players[playerId];
  return zones.some((zone) => {
    switch (zone) {
      case "draw":
      case "hand":
      case "cycle":
      case "eliminated":
      case "reserve":
        return player[zone].includes(instanceId);
      case "battleground":
        return (
          (state.activeBattleground?.cards.includes(instanceId) ?? false) ||
          state.additionalActiveBattlegrounds.some((battleground) =>
            battleground.cards.includes(instanceId)
          )
        );
      case "path":
        return state.activePath?.cards.includes(instanceId) ?? false;
    }
  });
}

function canPlayDrawnCardWithoutCost(
  state: GameState,
  playerId: PlayerId,
  play: DrawnCardPlayChoice,
): boolean {
  if (!canPlayTo(state, playerId, play.cardId, play.destination)) {
    return false;
  }
  const card = getCardDefinition(getCard(state, play.cardId).cardId);
  return (
    (card.type !== "character" && card.type !== "item") ||
    !state.roundMemory.playedCharacterOrItemCards.includes(card.id)
  );
}

function validCombatLossSelections(
  state: GameState,
  decision: Extract<PendingDecision, { readonly type: "combatLosses" }>,
): readonly (readonly string[])[] {
  if (decision.attackToCancel <= 0) {
    return [[]];
  }
  const candidates = [...decision.candidates];
  const totalDefense = candidates.reduce(
    (sum, instanceId) =>
      sum + defenseIconsFor(state, instanceId, decision.locationType),
    0,
  );
  if (totalDefense <= decision.attackToCancel) {
    return [candidates];
  }

  const selections: string[][] = [];
  for (let mask = 1; mask < 2 ** candidates.length; mask += 1) {
    const selection = candidates.filter(
      (_instanceId, index) => (mask & (1 << index)) !== 0,
    );
    const defense = selection.reduce(
      (sum, instanceId) =>
        sum + defenseIconsFor(state, instanceId, decision.locationType),
      0,
    );
    if (defense < decision.attackToCancel) {
      continue;
    }
    const hasUnnecessaryDefender = selection.some((removed) => {
      return (
        defense -
          defenseIconsFor(state, removed, decision.locationType) >=
        decision.attackToCancel
      );
    });
    if (!hasUnnecessaryDefender) {
      selections.push(selection);
    }
  }
  return selections;
}

function sameCardSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((instanceId) => right.includes(instanceId))
  );
}

function playDrawnCardWithoutCost(
  state: GameState,
  playerId: PlayerId,
  play: DrawnCardPlayChoice,
): GameState {
  const card = getCardDefinition(getCard(state, play.cardId).cardId);
  let nextState = updatePlayer(state, playerId, (player) => ({
    ...player,
    hand: removeOne(player.hand, play.cardId),
    reserve:
      play.destination === "reserve"
        ? [...player.reserve, play.cardId]
        : player.reserve,
  }));

  if (play.destination === "reserve") {
    nextState = {
      ...nextState,
      roundMemory: {
        ...nextState.roundMemory,
        playedToReserve: uniqueAppend(
          nextState.roundMemory.playedToReserve,
          play.cardId,
        ),
      },
    };
  } else if (play.destination === "battleground") {
    nextState = {
      ...nextState,
      activeBattleground:
        nextState.activeBattleground === null
          ? null
          : {
              ...nextState.activeBattleground,
              cards: [...nextState.activeBattleground.cards, play.cardId],
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
              cards: [...nextState.activePath.cards, play.cardId],
            },
    };
  }

  if (card.type === "character" || card.type === "item") {
    nextState = rememberCharacterOrItemPlayed(nextState, card.id);
  }
  return addLog(
    nextState,
    `${players[playerId].name} played ${card.title} to ${play.destination} from a card-effect draw.`,
  );
}

export function legalForsakeChoices(
  state: GameState,
  playerId: PlayerId,
): readonly ForsakeChoice[] {
  const player = state.players[playerId];
  return [
    ...player.hand.map((cardId) => ({
      source: "hand" as const,
      cardId,
    })),
    ...player.reserve.map((cardId) => ({
      source: "reserve" as const,
      cardId,
    })),
    ...controlledReserveItems(state, playerId).map((cardId) => ({
      source: "reserve" as const,
      cardId,
    })),
    ...(player.draw.length + player.cycle.length > 0
      ? [{ source: "draw" as const }]
      : []),
  ];
}

export function availableForsakeCount(
  state: GameState,
  playerId: PlayerId,
): number {
  const player = state.players[playerId];
  return (
    player.hand.length +
    player.reserve.length +
    controlledReserveItems(state, playerId).length +
    player.draw.length +
    player.cycle.length
  );
}

function controlledReserveItems(
  state: GameState,
  playerId: PlayerId,
): readonly string[] {
  return state.players[playerId].reserve.flatMap(
    (wielderId) => state.attachments[wielderId] ?? [],
  );
}

function relocateCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  destination: "hand" | "cycle" | "eliminated",
): GameState {
  const withoutAttachment = stripEmptyAttachmentLists(
    removeAttachmentLinks(state, [instanceId]),
  );
  const withoutSharedZone = removeFromSharedPlayZones(
    withoutAttachment,
    instanceId,
  );
  return updatePlayer(withoutSharedZone, playerId, (player) => ({
    ...player,
    draw: removeOne(player.draw, instanceId),
    hand:
      destination === "hand"
        ? uniqueAppend(removeOne(player.hand, instanceId), instanceId)
        : removeOne(player.hand, instanceId),
    cycle:
      destination === "cycle"
        ? uniqueAppend(removeOne(player.cycle, instanceId), instanceId)
        : removeOne(player.cycle, instanceId),
    reserve: removeOne(player.reserve, instanceId),
    eliminated:
      destination === "eliminated"
        ? uniqueAppend(removeOne(player.eliminated, instanceId), instanceId)
        : removeOne(player.eliminated, instanceId),
  }));
}

function accepted(state: GameState, events: readonly GameEvent[]): CommandResult {
  if (events.length === 0) {
    throw new Error("Accepted commands must emit at least one event.");
  }
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
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function defenseIconsFor(
  state: GameState,
  instanceId: string,
  combatType: "battleground" | "path",
): number {
  return combatIconsFor(
    state,
    instanceId,
    combatType === "path" ? "path" : "battleground-defense",
  );
}

function combatIconsFor(
  state: GameState,
  instanceId: string,
  combatType: "path" | "battleground-attack" | "battleground-defense",
): number {
  return expandWithAttachedItems(state, [instanceId]).reduce(
    (sum, cardId) => {
      const definition = getCardDefinition(getCard(state, cardId).cardId);
      switch (combatType) {
        case "path":
          return sum + definition.pathIcons;
        case "battleground-attack":
          return sum + definition.battlegroundAttack + definition.leadershipAttack;
        case "battleground-defense":
          return sum + definition.battlegroundDefense + definition.leadershipDefense;
      }
    },
    0,
  );
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
