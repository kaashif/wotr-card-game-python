import { describe, expect, it } from "vitest";

import { battlegroundDefinitions, pathDefinitions } from "./data";
import { createGame, resolveCombat } from "./game";
import { assertGameInvariants } from "./invariants";
import type { GameState, Side } from "./types";

describe("combat rules", () => {
  it("awards an empty battleground to its defending side", () => {
    const state = battlegroundOnlyState("empty-battleground");
    const definition = activeBattlegroundDefinition(state);
    expect(definition).toBeDefined();
    if (definition === undefined) {
      return;
    }

    const next = resolveCombat(state);

    expect(next.scoringAreas.battlegrounds[definition.side]).toContain(
      definition.id,
    );
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("applies battleground attack tokens after printed location defense", () => {
    const base = battlegroundOnlyState("battleground-attack-tokens");
    const definition = activeBattlegroundDefinition(base);
    expect(definition).toBeDefined();
    if (definition === undefined || base.activeBattleground === null) {
      return;
    }
    const state = {
      ...base,
      activeBattleground: {
        ...base.activeBattleground,
        attackTokens: definition.defenseIcons + 1,
      },
    };

    const next = resolveCombat(state);
    const attacker = oppositeSide(definition.side);

    expect(next.scoringAreas.battlegrounds[attacker]).toContain(definition.id);
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("applies defense tokens before declaring an uncontested attacker win", () => {
    const base = battlegroundOnlyState("battleground-defense-tokens");
    const definition = activeBattlegroundDefinition(base);
    expect(definition).toBeDefined();
    if (definition === undefined || base.activeBattleground === null) {
      return;
    }
    const state = {
      ...base,
      activeBattleground: {
        ...base.activeBattleground,
        attackTokens: definition.defenseIcons + 1,
        defenseTokens: 1,
      },
    };

    const next = resolveCombat(state);

    expect(next.scoringAreas.battlegrounds[definition.side]).toContain(
      definition.id,
    );
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("awards an empty path to Free Peoples for its printed victory points", () => {
    const base = createGame("empty-path");
    const path = pathDefinitions.find(
      (definition) => definition.id === base.activePath?.id,
    );
    expect(path).toBeDefined();
    if (path === undefined) {
      return;
    }
    const state = {
      ...base,
      phase: "combat" as const,
      activeBattleground: null,
      additionalActiveBattlegrounds: [],
    };

    const next = resolveCombat(state);

    expect(next.scoringAreas.paths.free).toContainEqual({
      id: path.id,
      points: path.victoryPoints,
      facedown: false,
    });
    expect(assertGameInvariants(next)).toEqual([]);
  });
});

function battlegroundOnlyState(seed: string): GameState {
  return {
    ...createGame(seed),
    phase: "combat",
    activePath: null,
    additionalActiveBattlegrounds: [],
  };
}

function activeBattlegroundDefinition(state: GameState) {
  return battlegroundDefinitions.find(
    (definition) => definition.id === state.activeBattleground?.id,
  );
}

function oppositeSide(side: Side): Side {
  return side === "free" ? "shadow" : "free";
}
