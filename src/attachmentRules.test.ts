import { describe, expect, it } from "vitest";

import {
  attachItem,
  canAttachItemTo,
  createGame,
  getPathDefinition,
  moveFromReserve,
  resolveCombat,
  tryForsake,
} from "./game";
import { getLegalActions } from "./legalActions";
import { assertGameInvariants } from "./invariants";
import type { GameState, PlayerId } from "./types";

const itemOwner: PlayerId = "aragorn";
const wielderOwner: PlayerId = "frodo";
const cloak = "aragorn-elven-cloak-58-1";
const frodo = "frodo-frodo-baggins-69-1";
const cost = "aragorn-aragorn-38-1";
const bow = "aragorn-bow-of-galadhrim-57-1";
const legolas = "aragorn-legolas-56-1";

describe("attachment ownership and movement", () => {
  it("allows an item to be attached to a teammate's eligible character", () => {
    const state = arrangeAttachmentCards(createGame("teammate-item"));

    expect(canAttachItemTo(state, itemOwner, cloak, frodo)).toBe(true);
    const next = attachItem(state, itemOwner, cloak, frodo, cost);

    expect(next.attachments[frodo]).toEqual([cloak]);
    expect(next.players[itemOwner].cycle).toContain(cost);
    expect(next.players[wielderOwner].reserve).toContain(frodo);
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("keeps an attached item with its wielder when the wielder moves", () => {
    const attached = attachItem(
      arrangeAttachmentCards(createGame("move-attached-item")),
      itemOwner,
      cloak,
      frodo,
      cost,
    );

    const next = moveFromReserve(attached, wielderOwner, frodo, "path");

    expect(next.activePath?.cards).toContain(frodo);
    expect(next.attachments[frodo]).toEqual([cloak]);
    expect(next.players[itemOwner].reserve).not.toContain(cloak);
    expect(next.players[wielderOwner].reserve).not.toContain(frodo);
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("counts attached icons and cycles each card to its owner's pile", () => {
    const attached = attachItem(
      arrangeAttachmentCards(createGame("attached-combat-icons")),
      itemOwner,
      cloak,
      frodo,
      cost,
    );
    const moved = moveFromReserve(attached, wielderOwner, frodo, "path");
    const pathDefense =
      moved.activePath === null
        ? 0
        : getPathDefinition(moved.activePath.id)?.defenseIcons ?? 0;
    const state = {
      ...moved,
      phase: "combat" as const,
      currentPathNumber: 9,
      activeBattleground: null,
      additionalActiveBattlegrounds: [],
      activePath:
        moved.activePath === null
          ? null
          : {
              ...moved.activePath,
              attackTokens:
                pathDefense + moved.activePath.defenseTokens + 2,
            },
    };

    const next = resolveCombat(state);

    expect(next.scoringAreas.paths.free).toHaveLength(1);
    expect(next.players[wielderOwner].cycle).toContain(frodo);
    expect(next.players[itemOwner].cycle).toContain(cloak);
    expect(next.attachments[frodo]).toBeUndefined();
    expect(assertGameInvariants(next)).toEqual([]);
  });

  it("prevents a Bow of Galadhrim wielder from taking another weapon", () => {
    const syntheticBow = "aragorn-bow-of-galadhrim-57-test-copy";
    const cloakForElf = "aragorn-elven-cloak-58-1";
    const base = createGame("bow-weapon-restriction");
    const arranged = setPlayerZones(base, itemOwner, {
      hand: [syntheticBow, cloakForElf],
      reserve: [legolas],
    });
    const state: GameState = {
      ...arranged,
      cards: {
        ...arranged.cards,
        [syntheticBow]: {
          instanceId: syntheticBow,
          cardId: arranged.cards[bow]?.cardId ?? "bow-of-galadhrim-57",
        },
      },
      attachments: {
        [legolas]: [bow],
      },
    };

    expect(canAttachItemTo(state, itemOwner, syntheticBow, legolas)).toBe(false);
    expect(canAttachItemTo(state, itemOwner, cloakForElf, legolas)).toBe(true);
  });

  it("lets a reserve wielder's controller forsake a teammate-owned item", () => {
    const attached = attachItem(
      arrangeAttachmentCards(createGame("controlled-item-forsake")),
      itemOwner,
      cloak,
      frodo,
      cost,
    );
    const state: GameState = {
      ...attached,
      pendingDecisions: [
        {
          type: "forsake",
          playerId: wielderOwner,
          minimum: 1,
          reason: "test",
        },
      ],
    };

    expect(
      getLegalActions(state, wielderOwner).pendingDecision,
    ).toMatchObject({
      type: "forsake",
      choices: expect.arrayContaining([
        { source: "reserve", cardId: cloak },
      ]),
    });

    const result = tryForsake(attached, wielderOwner, "reserve", cloak);

    expect(result.ok).toBe(true);
    expect(result.state.players[itemOwner].eliminated).toContain(cloak);
    expect(result.state.attachments[frodo]).toBeUndefined();
    expect(result.state.players[wielderOwner].reserve).toContain(frodo);
    expect(assertGameInvariants(result.state)).toEqual([]);
  });
});

function arrangeAttachmentCards(state: GameState): GameState {
  return setPlayerZones(
    setPlayerZones(state, itemOwner, {
      hand: [cloak, cost],
    }),
    wielderOwner,
    {
      reserve: [frodo],
    },
  );
}

function setPlayerZones(
  state: GameState,
  playerId: PlayerId,
  overrides: {
    readonly hand?: readonly string[];
    readonly reserve?: readonly string[];
  },
): GameState {
  const player = state.players[playerId];
  const hand = overrides.hand ?? [];
  const reserve = overrides.reserve ?? [];
  const placed = new Set([...hand, ...reserve]);
  const owned = [
    ...player.draw,
    ...player.hand,
    ...player.cycle,
    ...player.eliminated,
    ...player.reserve,
  ];
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        draw: [],
        hand,
        cycle: [],
        reserve,
        eliminated: owned.filter((instanceId) => !placed.has(instanceId)),
      },
    },
  };
}
