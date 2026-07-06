import { describe, expect, it } from "vitest";

import { cardDefinitions } from "./data";
import {
  cardEffectImplementations,
  getCardEffectImplementation,
} from "./cardEffectScripts";

describe("card effect implementation registry", () => {
  it("has an implementation record for every card", () => {
    expect(cardEffectImplementations).toHaveLength(cardDefinitions.length);
    expect(new Set(cardEffectImplementations.map((entry) => entry.cardId)).size).toBe(
      cardDefinitions.length,
    );
    for (const card of cardDefinitions) {
      expect(getCardEffectImplementation(card.id).cardId).toBe(card.id);
    }
  });

  it("marks no-text cards as implemented no-ops", () => {
    const noTextCards = cardDefinitions.filter((card) => card.text.trim() === "");
    expect(noTextCards.length).toBeGreaterThan(0);
    for (const card of noTextCards) {
      const implementation = getCardEffectImplementation(card.id);
      expect(implementation.status).toBe("implemented");
      expect(implementation.scripts.some((script) =>
        script.instructions.some((instruction) => instruction.type === "noop"),
      )).toBe(true);
    }
  });

  it("scripts every card effect record", () => {
    const todo = cardEffectImplementations.filter((entry) => entry.status === "todo");
    expect(todo).toEqual([]);
    expect(
      cardEffectImplementations.flatMap((entry) =>
        entry.scripts.flatMap((script) =>
          script.instructions.filter((instruction) => instruction.type === "todo"),
        ),
      ),
    ).toEqual([]);
  });

  it("scripts known high-value card effects", () => {
    expect(instructionTypes("boromir-39")).toEqual(expect.arrayContaining(["draw", "forsake"]));
    expect(instructionTypes("smeagol-92")).toEqual(
      expect.arrayContaining(["activatePath", "addCorruption", "replacementCycleInstead"]),
    );
    expect(instructionTypes("the-ringwraiths-are-abroad-164")).toEqual(
      expect.arrayContaining(["draw", "playFromDrawn", "cycleRestDrawn"]),
    );
    expect(instructionTypes("the-hunter-nazgul-147")).toEqual(
      expect.arrayContaining(["cycleSelf", "addPathAttack"]),
    );
  });
});

function instructionTypes(cardId: string): readonly string[] {
  return getCardEffectImplementation(cardId).scripts.flatMap((script) =>
    script.instructions.map((instruction) => instruction.type),
  );
}
