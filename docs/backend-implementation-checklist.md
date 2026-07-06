# Backend Implementation Checklist

This checklist tracks the remaining work before the War of the Ring Card Game
backend is fully implemented. It starts from the current `master` rules-kernel
state after PR #22 and PR #23.

## Command And Event Architecture

- [ ] Replace remaining string/log-driven behavior with typed `GameEvent`s.
- [ ] Ensure every accepted command emits event records.
- [ ] Ensure every rejected command preserves the state hash.
- [ ] Define stable command APIs for player actions.
- [ ] Define stable command APIs for pending decisions.
- [ ] Define stable command APIs for card-text choices.

## Pending Decisions

- [ ] Implement forsake choices as pending decisions.
- [ ] Implement defender casualty/loss assignment as pending decisions.
- [ ] Implement draw N / play up to M / cycle rest choices.
- [ ] Implement search/take/reveal choices.
- [ ] Implement optional `may` effects.
- [ ] Implement combat order choices.
- [ ] Implement opponent-choice fallback when defenders cannot agree.

## Location Activation

- [ ] Activate battlegrounds from the correct side deck.
- [ ] Fall back to the other side deck when the starting side deck is empty.
- [ ] Handle no-battleground activation when both decks are empty.
- [ ] Activate specific battlegrounds from a deck by card/location text.
- [ ] Reshuffle a battleground deck after search/take.
- [ ] Reactivate battlegrounds from scoring areas, not decks.
- [ ] Re-run activation text for reactivated battlegrounds.
- [ ] Implement reactivated battleground defense-ignore rule.
- [ ] Support multiple active battlegrounds.

## Path Activation And Replacement

- [ ] Randomly choose the first path among path 1 cards.
- [ ] Randomly choose later paths among the next path number.
- [ ] Let card text choose eligible same-number paths.
- [ ] Let card text choose eligible next-higher paths.
- [ ] Prevent activating a specific path more than once per game.
- [ ] Resolve current path combat before replacing active path.
- [ ] Handle path 9 activation and final path edge cases.
- [ ] Handle no eligible path as a rejected action or explicit no-op.

## Location Text Effects

- [ ] Implement all path activation text.
- [ ] Implement all battleground activation text.
- [ ] Implement location draw effects.
- [ ] Implement location forsake effects.
- [ ] Implement location cycle effects.
- [ ] Implement location draw/play/cycle-rest effects.
- [ ] Implement named battleground/path activation text.
- [ ] Model mandatory vs optional location text.

## Card Effect Engine

- [ ] Implement `when played` effects.
- [ ] Implement `when played or moved` effects.
- [ ] Implement reserve action effects.
- [ ] Implement action effects from in-play cards.
- [ ] Implement action effects from in-play items.
- [ ] Implement once-per-round limits.
- [ ] Implement once-per-game limits.
- [ ] Implement search/take from draw deck.
- [ ] Implement search/take from cycle pile.
- [ ] Implement eliminate/cycle/forsake as costs.
- [ ] Implement token effects.
- [ ] Implement corruption effects.
- [ ] Implement replacement effects.

## Card-Specific Rules

- [ ] Implement Aragorn / Strider interactions.
- [ ] Implement Gandalf the Grey / Gandalf the White interactions.
- [ ] Implement Merry and Pippin battleground exceptions.
- [ ] Implement Red Arrow temporary legality modifier.
- [ ] Implement Three Hunters temporary play/move/support modifier.
- [ ] Implement Shadowfax battleground reactivation flow.
- [ ] Implement Anduril battleground reactivation flow.
- [ ] Implement The Black Captain battleground reactivation flow.
- [ ] Implement Threats and Promises battleground reactivation flow.
- [ ] Implement Balrog timing.
- [ ] Implement Shelob timing.
- [ ] Implement Boromir forsake timing.
- [ ] Implement Palantir edge cases.
- [ ] Implement draw/play/cycle-rest cards.
- [ ] Implement Mouth of Sauron restrictions.
- [ ] Implement Lidless Eye restrictions.
- [ ] Implement Ringwraiths Are Abroad.
- [ ] Implement Day Without Dawn.
- [ ] Implement all remaining named card text from `docs/rules-edge-case-plan.md`.

## Items, Attachments, Ownership, And Control

- [ ] Model owner vs controller explicitly.
- [ ] Support items attached to teammate characters.
- [ ] Move items with their wielders.
- [ ] Cycle items to the item owner's cycle pile.
- [ ] Apply item replacement effects with wielder replacement effects.
- [ ] Enforce weapon restrictions such as Bow of Galadhrim.
- [ ] Keep items on active characters from unactivating the character.
- [ ] Implement item forsake/control semantics for reserve wielders.

## Combat

- [ ] Model path combat and battleground combat explicitly.
- [ ] Determine attacker and defender sides by combat type/location.
- [ ] Apply location defense icons before card defense.
- [ ] Apply defense tokens before card defense.
- [ ] Require defenders to cancel as many attack icons as possible.
- [ ] Implement defender loss assignment choices.
- [ ] Implement leadership icon support assignment.
- [ ] Enforce one army supporting only one leader.
- [ ] Handle ambiguous support choices.
- [ ] Cycle remaining defenders after combat.
- [ ] Eliminate attackers according to battleground/path combat rules.
- [ ] Score Shadow path success as corruption.
- [ ] Score Free Peoples path success as printed path VP.
- [ ] Handle combat with no cards.
- [ ] Handle uncontested combat.
- [ ] Handle combat ties and equality cases.
- [ ] Handle final path combat.

## Scoring And Game End

- [ ] Fully implement scoring areas by side.
- [ ] Store Shadow-scored paths facedown as VP reminders.
- [ ] Keep corruption and Shadow score synchronized where rules require.
- [ ] Implement early victory by 10-point gap.
- [ ] Implement final scoring after Mount Doom / final path.
- [ ] Add unused Ring token VP for Trilogy final scoring.
- [ ] Implement Trilogy tie rule.
- [ ] Implement Duel scoring differences.

## Scenarios

- [ ] Formalize Trilogy scenario definition.
- [ ] Implement Two-player Duel.
- [ ] Implement Three-player Duel.
- [ ] Implement Fellowship scenario.
- [ ] Make scenario affect decks.
- [ ] Make scenario affect turn order.
- [ ] Make scenario affect draw counts.
- [ ] Make scenario affect ring-token behavior.
- [ ] Make scenario affect path lists.
- [ ] Make scenario affect battleground setup.
- [ ] Make scenario affect scoring and game end.

## Visibility And Public View Models

- [ ] Hide opponent hands from public views.
- [ ] Redact hidden search information.
- [ ] Prevent public logs from revealing hidden card identities.
- [ ] Separate private `GameState` from public/UI view models.
- [ ] Add visibility-aware archive/replay output.

## Archive And Replay Hardening

- [ ] Formalize event metadata versioning.
- [ ] Replay all typed events.
- [ ] Detect rules/data/engine drift.
- [ ] Persist failing fuzz sequences as compact archive fixtures.
- [ ] Verify checkpoint replay equals full replay.
- [ ] Verify archive replay equals incremental state.

## Fuzz And Property Testing

- [ ] Add command-sequence generators.
- [ ] Generate mostly legal commands.
- [ ] Generate intentionally illegal commands.
- [ ] Assert illegal commands return typed violations.
- [ ] Assert illegal commands preserve state hash.
- [ ] Assert every accepted command satisfies invariants.
- [ ] Generate pending-decision-aware command streams.
- [ ] Exhaustively generate small combat states.
- [ ] Add CI smoke fuzz.
- [ ] Add nightly deep fuzz.
- [ ] Archive minimized failing sequences.

## BGG Ambiguity Fixtures

- [ ] Convert every BGG ambiguity into a named regression fixture.
- [ ] Store source URL for each fixture.
- [ ] Store local rule/card lines for each fixture.
- [ ] Store the encoded engine decision for each fixture.
- [ ] Store confidence/notes for each fixture.
- [ ] Cover no-card combat ambiguity.
- [ ] Cover reactivation ambiguity.
- [ ] Cover item/reserve ambiguity.
- [ ] Cover support ambiguity.
- [ ] Cover draw/play/cycle-rest ambiguity.
- [ ] Cover path replacement timing ambiguity.

## Legal Actions And UI Affordances

- [ ] Expose legal actions for the current state from the backend.
- [ ] Expose legal card destinations from the backend.
- [ ] Expose legal reserve actions from the backend.
- [ ] Expose legal pending-decision choices from the backend.
- [ ] Expose pass legality and reason from the backend.
- [ ] Stop UI code from guessing the best destination.

## Cleanup

- [ ] Route all state changes through consistent `try*` command paths.
- [ ] Remove or replace direct-mutating legacy command helpers.
- [ ] Remove or replace the old renderer once the real UI is stable.
- [ ] Keep storage normalization updated for every new state field.
- [ ] Keep tests and archives updated when metadata/rules versions change.
