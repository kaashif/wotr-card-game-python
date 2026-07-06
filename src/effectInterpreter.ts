import {
  addActivePathAttackTokens,
  addActivePathDefenseTokens,
  addCorruption,
  drawForPlayer,
  enqueuePendingDecision,
  removeCorruption,
} from "./game";
import {
  getCardEffectImplementation,
  type EffectInstruction,
  type EffectTarget,
  type EffectTiming,
} from "./cardEffectScripts";
import { players, turnOrder } from "./data";
import type { GameState, PlayerId } from "./types";

export interface ApplyCardEffectOptions {
  readonly cardId: string;
  readonly timing: EffectTiming;
  readonly controller: PlayerId;
}

export function applyCardEffectScripts(
  state: GameState,
  options: ApplyCardEffectOptions,
): GameState {
  const implementation = getCardEffectImplementation(options.cardId);
  return implementation.scripts
    .filter((script) => script.timing === options.timing)
    .flatMap((script) => script.instructions)
    .reduce(
      (nextState, instruction) =>
        applyInstruction(nextState, instruction, options.controller),
      state,
    );
}

function applyInstruction(
  state: GameState,
  instruction: EffectInstruction,
  controller: PlayerId,
): GameState {
  switch (instruction.type) {
    case "noop":
    case "todo":
    case "replacementCycleInstead":
    case "modifyCarryover":
      return state;
    case "draw":
      return applyToTargets(state, instruction.target, controller, (nextState, playerId) =>
        drawForPlayer(nextState, playerId, instruction.count),
      );
    case "addPathAttack":
      return addActivePathAttackTokens(state, instruction.count);
    case "addPathDefense":
      return addActivePathDefenseTokens(state, instruction.count);
    case "addCorruption":
      return addCorruption(state, instruction.count);
    case "removeCorruption":
      return removeCorruption(
        state,
        instruction.count === "hobbitsOnPath" ? hobbitsOnActivePath(state) : instruction.count,
      );
    case "forsake":
      return enqueueForTargets(state, instruction.target, controller, (playerId) => ({
        type: "forsake",
        playerId,
        reason: "card effect",
        minimum: instruction.count,
        source: "card-effect-script",
      }));
    case "cycleFromHand":
      return enqueueForTargets(state, instruction.target, controller, (playerId) => ({
        type: "forsake",
        playerId,
        reason: `cycle ${instruction.count} from hand`,
        minimum: instruction.count,
        source: "card-effect-script:cycle-from-hand",
      }));
    case "search":
      return enqueueForTargets(state, instruction.target, controller, (playerId) => ({
        type: "search",
        playerId,
        zones: instruction.from,
        choices: [],
        source: instruction.query,
      }));
    case "playFromDrawn":
      return enqueuePendingDecision(state, {
        type: "drawPlayCycleRest",
        playerId: controller,
        drawnCards: [],
        playableCards: [],
        maxPlays: instruction.max,
        source: instruction.filter,
      });
    case "cycleSelf":
    case "eliminateSelf":
    case "activatePath":
    case "activateBattleground":
    case "moveWielder":
    case "addBattlegroundAttack":
    case "addBattlegroundDefense":
    case "cycleRestDrawn":
      return enqueuePendingDecision(state, {
        type: "search",
        playerId: controller,
        zones: ["inPlay"],
        choices: [],
        source: `unresolved:${instruction.type}`,
      });
  }
}

function applyToTargets(
  state: GameState,
  target: EffectTarget,
  controller: PlayerId,
  apply: (state: GameState, playerId: PlayerId) => GameState,
): GameState {
  return targetPlayers(target, controller).reduce(apply, state);
}

function enqueueForTargets(
  state: GameState,
  target: EffectTarget,
  controller: PlayerId,
  decision: (playerId: PlayerId) => Parameters<typeof enqueuePendingDecision>[1],
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

function hobbitsOnActivePath(state: GameState): number {
  return (state.activePath?.cards ?? []).filter((instanceId) => {
    const card = state.cards[instanceId];
    return card?.cardId.includes("frodo") || card?.cardId.includes("sam") ||
      card?.cardId.includes("merry") || card?.cardId.includes("pippin") ||
      card?.cardId.includes("bilbo") || card?.cardId.includes("fatty");
  }).length;
}
