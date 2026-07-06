import { describe, expect, it } from "vitest";

import { battlegroundDefinitions, cardDefinitions, pathDefinitions } from "./data";
import { effectClassifications } from "./effectClassification";

describe("effect classification", () => {
  it("classifies every card, path, and battleground reference", () => {
    expect(effectClassifications).toHaveLength(
      cardDefinitions.length + pathDefinitions.length + battlegroundDefinitions.length,
    );
    expect(effectClassifications.every((entry) => entry.sourceLine > 0)).toBe(true);
  });

  it.each([
    ["draw"],
    ["cycle"],
    ["forsake"],
    ["eliminate"],
    ["search"],
    ["reserve-action"],
    ["activate-battleground"],
    ["activate-path"],
    ["move"],
    ["token"],
    ["corruption"],
    ["replacement"],
    ["when-played"],
    ["when-played-or-moved"],
    ["draw-play-cycle-rest"],
  ] as const)("has at least one %s effect to drive backend fixtures", (tag) => {
    expect(effectClassifications.some((entry) => entry.tags.includes(tag))).toBe(true);
  });

  it("identifies known high-risk card templates", () => {
    expect(tagsFor("balrog-118")).toContain("when-played-or-moved");
    expect(tagsFor("shadowfax-86")).toEqual(
      expect.arrayContaining(["attach-item", "activate-battleground", "move", "reserve-action"]),
    );
    expect(tagsFor("the-ringwraiths-are-abroad-164")).toContain("draw-play-cycle-rest");
    expect(tagsFor("frodo-baggins-69")).toContain("replacement");
  });
});

function tagsFor(id: string): readonly string[] {
  const entry = effectClassifications.find((candidate) => candidate.id === id);
  if (entry === undefined) {
    throw new Error(`Missing classification for ${id}`);
  }
  return entry.tags;
}
