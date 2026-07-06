import { battlegroundDefinitions, pathDefinitions, turnOrder } from "./data";
import { getCardDefinition, validateState } from "./game";
import type { GameState } from "./types";

const battlegroundIds: ReadonlySet<string> = new Set(
  battlegroundDefinitions.map((battleground) => battleground.id),
);
const pathIds: ReadonlySet<string> = new Set(pathDefinitions.map((path) => path.id));

export function assertGameInvariants(state: GameState): readonly string[] {
  const errors: string[] = [...validateState(state)];
  const allCardIds = new Set(Object.keys(state.cards));
  const physicalLocations = physicalCardLocations(state);

  for (const instanceId of allCardIds) {
    if ((physicalLocations.get(instanceId)?.length ?? 0) !== 1) {
      errors.push(`Card ${instanceId} must have exactly one physical location.`);
    }
  }

  for (const [instanceId, locations] of physicalLocations) {
    if (!allCardIds.has(instanceId)) {
      errors.push(`Unknown card ${instanceId} appears in ${locations.join(", ")}.`);
    }
    if (locations.length > 1) {
      errors.push(`Card ${instanceId} appears in multiple locations: ${locations.join(", ")}.`);
    }
  }

  for (const [wielderId, itemIds] of Object.entries(state.attachments)) {
    const wielder = state.cards[wielderId];
    if (wielder === undefined) {
      continue;
    }
    if (getCardDefinition(wielder.cardId).type !== "character") {
      errors.push(`Attachment wielder ${wielderId} must be a character.`);
    }
    for (const itemId of itemIds) {
      const item = state.cards[itemId];
      if (item === undefined) {
        continue;
      }
      if (getCardDefinition(item.cardId).type !== "item") {
        errors.push(`Attached card ${itemId} must be an item.`);
      }
    }
  }

  if (state.corruption.tokens < 0) {
    errors.push("Corruption cannot be negative.");
  }
  if (state.score.free < 0 || state.score.shadow < 0) {
    errors.push("Scores cannot be negative.");
  }

  for (const side of ["free", "shadow"] as const) {
    for (const battlegroundId of state.scoringAreas.battlegrounds[side]) {
      if (!battlegroundIds.has(battlegroundId)) {
        errors.push(`Unknown scored battleground: ${battlegroundId}.`);
      }
    }
    for (const path of state.scoringAreas.paths[side]) {
      if (!pathIds.has(path.id)) {
        errors.push(`Unknown scored path: ${path.id}.`);
      }
      if (path.points < 0) {
        errors.push(`Scored path ${path.id} has negative points.`);
      }
    }
  }

  const scoredBattlegrounds = [
    ...state.scoringAreas.battlegrounds.free,
    ...state.scoringAreas.battlegrounds.shadow,
  ];
  if (new Set(scoredBattlegrounds).size !== scoredBattlegrounds.length) {
    errors.push("A battleground appears in more than one scoring area.");
  }

  const scoredPaths = [
    ...state.scoringAreas.paths.free.map((path) => path.id),
    ...state.scoringAreas.paths.shadow.map((path) => path.id),
  ];
  if (new Set(scoredPaths).size !== scoredPaths.length) {
    errors.push("A path appears in more than one scoring area.");
  }

  for (const pathId of state.activatedPaths) {
    if (!pathIds.has(pathId)) {
      errors.push(`Unknown activated path: ${pathId}.`);
    }
  }
  if (new Set(state.activatedPaths).size !== state.activatedPaths.length) {
    errors.push("A path was activated more than once.");
  }

  for (const playerId of turnOrder) {
    const player = state.players[playerId];
    if (player.id !== playerId) {
      errors.push(`Player state ${playerId} has mismatched id ${player.id}.`);
    }
  }

  for (const instanceId of state.roundMemory.playedToReserve) {
    if (!allCardIds.has(instanceId)) {
      errors.push(`Round memory references unknown reserve card: ${instanceId}.`);
    }
  }

  return errors;
}

function physicalCardLocations(state: GameState): ReadonlyMap<string, readonly string[]> {
  const locations = new Map<string, string[]>();
  const add = (instanceId: string, location: string): void => {
    locations.set(instanceId, [...(locations.get(instanceId) ?? []), location]);
  };

  for (const playerId of turnOrder) {
    const player = state.players[playerId];
    for (const zone of ["draw", "hand", "cycle", "eliminated", "reserve"] as const) {
      for (const instanceId of player[zone]) {
        add(instanceId, `${playerId}.${zone}`);
      }
    }
  }
  for (const instanceId of state.activePath?.cards ?? []) {
    add(instanceId, `path.${state.activePath?.id ?? "unknown"}`);
  }
  for (const instanceId of state.activeBattleground?.cards ?? []) {
    add(instanceId, `battleground.${state.activeBattleground?.id ?? "unknown"}`);
  }
  for (const [wielderId, itemIds] of Object.entries(state.attachments)) {
    for (const itemId of itemIds) {
      add(itemId, `attached.${wielderId}`);
    }
  }
  return locations;
}
