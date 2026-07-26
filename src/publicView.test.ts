import { describe, expect, it } from "vitest";

import { createGame, enqueuePendingDecision } from "./game";
import { createPublicGameView } from "./publicView";

describe("public game views", () => {
  it("shows a viewer their own private zones but only opponent counts", () => {
    const state = createGame("public-view-zones");
    const view = createPublicGameView(state, "frodo");

    expect(view.players.frodo.hand.cards).toEqual(state.players.frodo.hand);
    expect(view.players.frodo.cycle.cards).toEqual(state.players.frodo.cycle);
    expect(view.players.frodo.draw.cards).toBeNull();
    expect(view.players.aragorn.hand).toEqual({
      count: state.players.aragorn.hand.length,
      cards: null,
    });
    expect(view.players.aragorn.cycle.cards).toBeNull();
    expect(view.players.aragorn.reserve.cards).toEqual(
      state.players.aragorn.reserve,
    );
  });

  it("redacts another player's search candidates from decisions and events", () => {
    const base = createGame("public-view-search");
    const secretChoices = base.players.witchKing.draw.slice(0, 3);
    const state = enqueuePendingDecision({
      ...base,
      pendingDecisions: [],
    }, {
      type: "search",
      playerId: "witchKing",
      zones: ["draw"],
      choices: secretChoices,
      minimum: 1,
      maximum: 1,
      destination: "hand",
      source: "secret search",
    });

    const opponentView = createPublicGameView(state, "frodo");
    const ownerView = createPublicGameView(state, "witchKing");
    const serializedOpponentView = JSON.stringify(opponentView);

    expect(opponentView.pendingDecisions[0]).toEqual({
      type: "search",
      playerId: "witchKing",
      minimum: 1,
      maximum: 1,
      choiceCount: 3,
      source: "secret search",
    });
    expect(serializedOpponentView).not.toContain(secretChoices[0]);
    expect(ownerView.pendingDecisions[0]).toMatchObject({
      type: "search",
      choices: secretChoices,
    });
  });

  it("redacts opponent card identities from private cycle/forsake events", () => {
    const base = createGame("public-view-events");
    const secret = base.players.saruman.hand[0];
    expect(secret).toBeDefined();
    if (secret === undefined) {
      return;
    }
    const state = {
      ...base,
      eventLog: [
        ...base.eventLog,
        { type: "cardCycled" as const, playerId: "saruman" as const, cardId: secret },
        {
          type: "cardForsaken" as const,
          playerId: "saruman" as const,
          source: "hand" as const,
          cardId: secret,
        },
      ],
    };

    const opponentView = createPublicGameView(state, "frodo");
    const ownerView = createPublicGameView(state, "saruman");

    expect(JSON.stringify(opponentView.events)).not.toContain(secret);
    expect(JSON.stringify(ownerView.events)).toContain(secret);
  });
});
