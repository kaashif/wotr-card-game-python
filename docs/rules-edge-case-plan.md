# Rules Edge Case Plan

This document records the current tested edge cases, known rules/card/BGG edge
cases, always-on invariants, and the recommended fuzz/property testing strategy.
It is intended to drive the next engine slices after the deterministic archive
and rules-kernel foundation work.

Primary references:

- `references/text/WaroftheRingCardGame_v1.1.txt`
- `references/text/All_War_of_the_Ring_cards_with_their_characteristics_and_functions_version_0.2.txt`
- `references/ambiguity-test-cases.md`
- `references/bgg-search-triage.md`
- `references/bgg-thread-urls.txt`
- `src/game.test.ts`
- `src/gameScripts.test.ts`
- `src/archive.test.ts`

## Current Tested Cases

- Reference import counts: 27 paths, 14 battlegrounds, 124 cards.
- Every loaded path, battleground, and card has source-line provenance.
- Same setup seed creates identical initial state.
- Setup creates a valid action-phase state with active path and battleground.
- Every card is in exactly one zone after setup.
- Each player starts with 5 cards in hand and 2 in cycle for Trilogy setup.
- Selecting a player does not mutate engine-owned card zones.
- Cycling a hand card removes it from hand and adds it to cycle.
- Ring token use marks the token used and draws 2.
- Reusing a used Ring token does not draw again.
- Legal reserve play moves card from hand to reserve.
- Legal reserve play cycles a different hand card as play cost.
- Items are not direct path/battleground plays.
- In the rules-kernel branch, items attach to indicated in-play wielders.
- Attached items are not also in reserve/hand/location zones.
- Last hand card can be played by forsaking from draw deck.
- Absolute final card can be played when no hand/draw/cycle card can pay more cost.
- Illegal battleground play leaves player zones unchanged.
- Combat smoke test advances round and path number.
- Combat smoke test scores at least one VP and preserves validity.
- JSON serialization/reload preserves state validity.
- Every live card instance resolves to a card definition.
- Passing above carryover is rejected unless enemy-hand condition is satisfied.
- A card played to reserve this round cannot move.
- A later-round reserve card can move to a legal destination.
- Winnow eliminates two hand cards and draws one.
- Forsake can choose hand, reserve, or top of draw.
- Compact replay export/render is deterministic.
- 180 seeds times all players for Ring-token action stay valid.
- 180 seeds times all players for hand cycling stay valid.
- 180 combat smoke replays stay valid.
- Every card is checked against reserve/path/battleground legality.
- Every army/character can be reserve-played with payment.
- Every army/character last-card reserve play uses forsake fallback.
- Archive records deterministic command journals with state hashes.
- Archive detects changed commands by replay hash mismatch.
- Archive detects metadata/reference-data drift.
- Archive refuses append when existing archive hashes do not verify.

## Generic Rules Edge Cases

- Location step activates one battleground before one path.
- Battleground activation normally uses the starting player's team deck.
- If own side's battleground deck is depleted, activate from the other side.
- If both battleground decks are depleted, no battleground activates.
- Specific battleground activation by card text chooses a matching deck card.
- After taking a specific battleground from a deck, reshuffle that deck.
- Reactivation takes battleground from a scoring area, not from a deck.
- Reactivated battleground resolves activation text again.
- Reactivated battleground keeps printed attacker/defender factions.
- Battleground from one side's scoring area reactivated by the other side ignores location defense icons.
- Multiple active battlegrounds may exist.
- Only one path may be active at once.
- First path is random among path 1 cards.
- Later location-step path is random among path number one higher than last activated path.
- Card-granted path activation chooses among eligible paths rather than random.
- Specific path cannot be activated more than once per game.
- A card text requiring an already activated path is unusable.
- Activating a new path while a path is active immediately resolves path combat on the replaced path.
- Mid-action path combat happens before the new path activation text resolves.
- Mid-action path combat is in addition to combat-step path combat.
- No eligible higher/same-number path should produce a rejected action or no-op by rules text.
- Path 9 and final path activation need explicit handling.
- Battleground combat is always during combat step.
- Path combat is during combat step and also when replaced mid-action.
- Starting player chooses combat resolution order during combat step.
- Combat resolves even if only one team has cards.
- Combat resolves even if neither team has cards.
- Action step begins with starting player and proceeds in scenario turn order.
- A turn allows one action or a legal pass.
- Pass legality depends on carryover limit or having fewer cards than each enemy player.
- Passing once does not prevent acting on a later turn if action step continues.
- Action step ends after all players have passed consecutively.
- Carryover limit starts at 2.
- Carryover limit can be modified by cards/items in play.
- No hand limit applies during draw, only action-end carryover.
- Playing a card cycles a different hand card immediately before resolving played text.
- If the played card was the last hand card, the player must forsake instead of cycling.
- Card text requiring cycle/forsake/eliminate is additional to play cost unless the text's "cycle rest" satisfies the cost.
- A player cannot voluntarily gain a benefit from an unpaid eliminate/forsake cost.
- If a mandatory eliminate/forsake is impossible, there is no extra penalty.
- You cannot choose to forsake instead of cycling unless cycle fallback applies.
- Winnow requires two different hand cards.
- Winnow cannot be paid from reserve, draw, or cycle.
- Drawing from an empty draw deck immediately recycles cycle pile and continues drawing.
- Normal recycle replaces empty draw deck with shuffled cycle pile.
- Game-text recycle may shuffle cycle pile into an existing draw deck.
- Taking a specific card from draw deck reveals/verifies and reshuffles afterward.
- Remove differs from eliminate/forsake and can target draw, cycle, hand, or in play.
- Removed card from draw deck causes reshuffle.
- Eliminated cards do not re-enter play unless a replacement effect cycles them instead.
- Hidden information is asymmetric: hands hidden, own cycle/eliminated inspectable, faceup in-play inspectable.
- Search/reveal effects must expose only enough information to verify legality.

## Play, Move, Item, And Attachment Edge Cases

- Army can play to reserve.
- Army can play/move to an active battleground only if faction is printed attacker/defender there.
- Army can never play/move to a path.
- Character can play to reserve.
- Character can play/move to active battleground only if faction is printed attacker/defender there.
- Character can play/move to active path only if path number is listed on card.
- Event resolves immediately, then is eliminated.
- Event is never in play.
- Event cannot be placed in reserve.
- Item is played onto a character card that becomes its wielder.
- Item can only be played on one of the indicated wielders.
- Wielder must already be in play.
- Item cannot be attached to an army.
- Item cannot be transferred between wielders.
- Item cannot be subject to battleground faction restriction separately from wielder.
- Wielder moving from reserve to path/battleground moves attached items too.
- If wielder is eliminated, attached items are eliminated unless replacement text says otherwise.
- If wielder is cycled, attached items cycle too.
- Item always cycles to original owner's cycle pile, even if controlled by another player.
- Item on reserve wielder can be forsaken only on behalf of wielder controller.
- Item defense icons cannot cancel attack icons separately from wielder.
- Item attached to teammate's character needs explicit ownership/control semantics.
- Item played onto active character should not "unactivate" the character.
- Weapon limitation: Bow of Galadhrim prevents another weapon on wielder.
- Cards played to reserve cannot move in the same round.
- In-reserve text is immediately active.
- Exact same character or item card cannot be played twice in one round.
- "When played" text does not fire when moved.
- "When played or moved" text fires once per qualifying play/move event.
- "Use an action" text requires the card to be in play and the correct controller/action window.
- Need explicit answer for teammate use of another player's in-play action.
- Need explicit "controller" vs "owner" model for attached items and stolen/cross-player effects.

## Combat Edge Cases

- On path, Shadow is always attacker and Free Peoples always defender.
- On Shadow battleground, Shadow defends and Free Peoples attacks.
- On Free Peoples battleground, Free Peoples defends and Shadow attacks.
- Printed attacking/defending factions of a battleground never change.
- Location defense icons cancel before defending cards.
- Defense tokens on location cancel before defending cards.
- Tokens on character/army are part of that card.
- Tokens on character/army cannot cancel separately from that card.
- Defender must cancel as many attack icons as possible.
- Defender casualty assignment is a player choice when multiple choices satisfy the rule.
- Opponent chooses defender losses if defenders cannot agree.
- Defending card eliminated for even one icon dies regardless of excess defense.
- Remaining defending cards cycle after combat.
- At end of path combat, all Shadow characters on that path are eliminated.
- At end of battleground combat, all attacking cards are eliminated.
- Items attached to defenders complicate defense value but do not cancel separately.
- Leadership icons count only if the character is supported by same-faction army on same battleground.
- One army can support only one character.
- Support assignment can be ambiguous with two leaders and one army.
- Army and supported leader can be lost separately.
- Leadership icons counted for current combat remain counted even if support/leader is later eliminated during loss assignment.
- Armies with zero stats may still support characters.
- Characters with no path icons can still be path legal if allowed path numbers match.
- Combat with no cards needs explicit winner/scoring oracle.
- Uncontested path should follow the normal path attack/defense computation.
- Uncontested battleground should follow normal attack/defense computation.
- Ties in path and battleground combat need explicit expected result.
- Order of cycling cards after combat can affect later draw/recycle effects.
- Battleground ownership/scoring area changes can affect later reactivation and VP swings.
- Different paths of same number must remain distinct for scoring/history.
- Shadow path success scores corruption tokens, not path VP.
- Free path success scores printed path VP.
- Path scored by Shadow is placed facedown as VP reminder.
- Corruption tokens can be added/removed by combat and card text.
- Removing corruption at zero should be a no-op.
- Token supply should be treated as unlimited unless later rules cap it.
- Final scoring adds unused Ring token VP in Trilogy only.
- Victory check can end game early if score gap is 10 or more.
- After final path combat, higher score wins; tie favors Shadow in Trilogy.

## Location And Scenario Edge Cases

- Trilogy setup: Frodo starts, turn order Frodo, Witch-king, Aragorn, Saruman.
- Trilogy setup: each player draws 7 and cycles 2.
- Trilogy draw: Free players draw 3, Shadow players draw 4.
- Trilogy Ring token: once per game draw 2; unused token worth 1 VP at final scoring.
- Two-player Duel has different player identities/decks.
- Two-player Duel has different setup hand counts and no initial cycle.
- Two-player Duel has different Ring token behavior: once per round, draw top 3, eliminate 1, cycle 1.
- Two-player Duel path scoring has special threshold/tie handling.
- Three-player Duel has Gandalf acting twice in turn order.
- Three-player Duel mixes Duel rules for Gandalf and Trilogy rules for Shadow.
- Fellowship scenario has specific limited decks.
- Fellowship scenario has specific ordered battlegrounds and limited path list.
- Fellowship scenario has no Ring tokens.
- Fellowship scenario ends at path 6 with 4-6 rounds.
- Scenario affects path deck, battleground deck, player decks, turn order, draw counts, ring rules, and scoring.
- 2/3 player control of multiple decks: decks remain separate; "you/player" applies to deck/player role.

## Card-Specific Edge Cases

- Bag End: Hobbit player draws 2 on activation.
- Gildor's Encampment: Elf draws 1 then cycles 1.
- Bucklebury Ferry: Mordor and Hobbit each draw 1.
- Old Forest: each Free Peoples player must forsake 1.
- Inn of the Prancing Pony: each Shadow player draws 2.
- Weathertop: Mordor draws 2.
- Fords of Bruinen: each Free player forsakes 1 then draws 3.
- Imladris/Rivendell: Elf draws 2.
- Council of Elrond: each Free player draws 1.
- Caradhras path: each Free player must forsake 1.
- Doors of Durin: Monstrous may forsake 1 to add path attack token.
- Khazad-Dum/Moria path: Monstrous draws 2.
- Dimrill Dale: each Shadow player must cycle 2 from hand.
- Egladil: each Free player draws 2 then cycles 1.
- Lothlorien: Elf draws 1 then cycles 1.
- Amon Hen: Mordor draws 1 then cycles 1.
- Emyn Muil: each Free player must forsake 1.
- Dead Marshes: Monstrous draws 2.
- Osgiliath: Dunedain may forsake 1 to draw 3.
- Cross Roads: each Free player draws 1.
- Henneth Annun: Dunedain draws 1.
- Morgul Vale: Mordor draws 5, may play one Nazgul character, cycles rest.
- Cirith Ungol: Mordor draws 5, may play one army, cycles rest.
- Shelob's Lair: Monstrous draws 2.
- Morgai: Shadow adds one path attack marker.
- Orodruin: Mordor draws 2.
- Crack of Doom: Monstrous draws 2.
- Helm's Deep: Rohan draws 5, may play one army/character there, cycles rest.
- Edoras: activate Helm's Deep if in Free Peoples battleground deck.
- Rivendell battleground: Elf draws 1 then cycles 1.
- Lorien: reactivate Dol Guldur.
- Dol Guldur: Lorien must be reactivated.
- Minas Tirith/Dol Amroth/Pelargir: Dunedain may forsake to draw.
- Minas Morgul: Mordor draws 5, may play one Nazgul character in reserve, cycles rest.
- Morannon: Mordor draws 5, may play one army, cycles rest.
- Harad/Umbar: each Shadow player draws 1.
- Orthanc: Isengard may take Saruman from draw/cycle into hand; recycle details matter.
- Dead Men of Dunharrow: special token bonus when supporting Strider/Aragorn.
- Knights of Dol Amroth: defense token on Dol Amroth.
- Guards of the Citadel: defense token on Minas Tirith.
- Great Gate: +3 defense on Minas Tirith; cannot play/move to Shadow battleground.
- Aragorn: when played remove Strider from game.
- Aragorn: while in reserve draw +1 in draw step.
- Aragorn: if forsaken from top of draw deck, cycle instead.
- Boromir: when played draw 1.
- Boromir: when played/moved to path, must forsake 1.
- Denethor: reserve action forsake 1 to take Boromir/Faramir from draw deck.
- Faramir: if played/moved to path 7, may activate different same-number path.
- Halbarad: reserve action cycle self to take Strider/Aragorn from draw deck.
- Prince Imrahil: when played may cycle 1 to take Knights from draw deck.
- Strider: path 7 action activates next-higher path.
- Strider: if Aragorn is played, remove Strider.
- Ioreth: after battleground combat cycles with another non-Wizard instead of eliminated; wielded items eliminated.
- Anduril: reserve action reactivates any Dunedain battleground, then must move wielder there.
- Paths of the Dead: forsake 2 then draw 4, or 5 if Strider/Aragorn in play.
- Red Arrow: this round Rohan cards may be played on Dunedain battlegrounds.
- Three Hunters: this round Strider/Aragorn, Gimli, Legolas may play/move to any battleground and be supported by any Free army.
- Arwen: when played draw 1; reserve adds defense token to Strider/Aragorn on path/battleground.
- Elrond: when played draw 1; reserve increases carryover by 1.
- Galadriel: when played draw 1; reserve draw +1 then cycle 1 in draw step.
- Legolas: when played may take Bow from draw deck.
- Bow of Galadhrim: wielder cannot wield another weapon.
- Elven Cloak: if wielder eliminated in path combat, cycle wielder and items instead.
- Lembas: on path action eliminate item to remove corruption per Hobbit character on path.
- Mirror of Galadriel: while in play may examine top draw card.
- Nenya: reserve action cycle item to add defense token to path or battleground.
- Phial: if on path, add 2 defense tokens to path.
- Vilya: reserve action cycle item so each Free player draws 1.
- Gimli: when played may take Dwarven Axe from cycle into hand.
- Frodo: if eliminated or forsaken, cycle instead; wielded items eliminated.
- Merry: can play/move to Rohan battleground supported by Rohan army; path-combat elimination cycles instead.
- Pippin: can play/move to Dunedain battleground supported by Dunedain army; path-combat elimination cycles instead.
- Sam: reserve action cycle self and wielded items to add path defense token.
- Bilbo: eliminated/forsaken cycles instead with items; reserve action cycle self to draw 2.
- Fatty: in reserve and when forsaken cycles instead with items; reserve action eliminate self to draw 3.
- Herbs and Stewed Rabbit: action eliminate item to take one Hobbit from cycle into hand and draw 1.
- Sting: if wielder on path with Monstrous character, add path defense token.
- Mithril Coat: item with path icons for Frodo/Sam.
- There Is Another Way: activate different same-number path and add defense token to new path.
- Eomer: when played draw 5, play up to one Rohan army, cycle rest.
- Eowyn: when played to battleground may eliminate one Nazgul; when played to reserve may take Merry/Pippin from cycle.
- Ghan-Buri-Ghan: reserve allows Rohan cards to play/move to Minas Tirith.
- Theoden: stats depend on Gandalf in play; when played draw 5, play up to one Rohan card, cycle rest.
- Shadowfax: reserve action reactivates any battleground, then must move Gandalf there.
- Death! Ride, Ride to Ruin: eliminate any number Rohan reserve cards; Mordor eliminates same number from active battlegrounds.
- Gandalf the Grey: path action activates next-higher path; if Gandalf the White played, eliminate Grey.
- Gandalf the White: when played remove Grey; reserve draw +1; top-deck forsake cycles instead.
- Treebeard: +1 on Orthanc; if played/moved to battleground, Isengard eliminates one Isengard army.
- Quickbeam: stats equal one for every two Isengard cards on same battleground.
- Smeagol: path action activates next-higher path and adds corruption; path-combat elimination cycles instead.
- Gwaihir: reserve action cycle self to take Gandalf from cycle.
- Gandalf's Staff/Saruman's Staff: while in play increase carryover limit.
- Narya: reserve action cycle item so each Shadow player cycles 1 from hand.
- Ent-draught: action eliminate item to take two Hobbit characters from cycle into hand.
- Grima: reserve action eliminate self to take Saruman from draw deck or eliminate Rohan character.
- Saruman: reserve draw +1; top-deck forsake cycles instead.
- Ugluk/Flocks/Gollum: path actions activate different same-number path.
- Palantir: reserve action once per round examine top 3, eliminate 1, cycle 1, take 1 to hand.
- Woven of All Colours: if Saruman eliminated in combat, cycle him and items instead.
- Threats and Promises: if Saruman in reserve, reactivate Isengard battleground and may move Saruman.
- Barrow-Wights/Hill Troll/Cave Troll/Caradhras/Candles: reserve actions eliminate self so each Free player forsakes.
- Balrog: +1 on Khazad-Dum; when played/moved to path or battleground each Free player forsakes.
- Shelob: +1 on Shelob's Lair; when played/moved to path or battleground each Free player forsakes.
- Gollum: if eliminated in path combat, cycle instead.
- Whip of Many Thongs: when played, draw 1.
- Southron reserve armies: eliminate self to activate named battleground if in correct deck.
- Black Serpent: reserve action reactivate any Southron battleground.
- Witch-King: reserve draw +1; top-deck forsake cycles instead.
- Nazgul Reaver: reserve action cycle self so each Free player forsakes.
- Nazgul Beguiler: reserve action cycle self so each Free player cycles 1 from hand.
- Nazgul Hunter: reserve action cycle self to add path attack token.
- Nazgul Messenger: reserve action cycle self to take Nazgul character from cycle.
- Black Easterling: +1 defense token on Dol Guldur; when played draw 1.
- Nazgul Commander: reserve action cycle self so each Shadow player draws 1.
- Nazgul Destroyer: reserve action cycle self to add battleground attack token.
- Nazgul Warrior: reserve action cycle self to add battleground defense token.
- Grishnakh: path action eliminate self to add corruption.
- Mouth of Sauron: cannot play/move to path if Shadow battleground active; reserve draw +1.
- Gorbag and Shagrat: when played/moved to path may cycle 1 from hand for attack token, 2 if Cirith Ungol active.
- Lidless Eye: cannot play/move to path if Shadow battleground active; when played each Shadow player draws 1; reserve increases carryover.
- Gothmog: reserve draw +1; when played remove Witch-King.
- Nazgul Mantle: if Nazgul eliminated in combat, cycle it and items instead.
- Black Breath: on path/battleground action cycles item, Nazgul, and items to add corruption.
- Black Riders Mount: when played on reserve Nazgul may immediately move them to path.
- Fell Beast: when played on reserve Nazgul may immediately move them to battleground.
- Morgul Blade: on path action eliminate item to add corruption.
- Black Captain: if Witch-King in reserve, reactivate Mordor battleground and may move Witch-King.
- Ringwraiths Are Abroad: draw 7, eliminate 1, play up to 2 Nazgul characters, cycle rest.
- Day Without Dawn: draw 7, eliminate 1, play up to 2 armies, cycle rest.

## BGG-Derived Regression Backlog

Each BGG-derived fixture should store the URL, title, local rule/card lines, and
the engine decision we intentionally encode.

- Last-card play cost.
- Absolute final card with no possible cost.
- Whether forsake can voluntarily replace cycle.
- Passing with more cards than carryover.
- Number of cards when passing.
- All-but-one player passes.
- Three-player Duel pass turn order.
- Items in reserve.
- Items on active characters.
- Item movement from reserve.
- Item on teammate's character.
- Whether item "unactivates" a character.
- Items on armies.
- Weapon characteristic for items.
- Shadowfax battleground scope.
- Gandalf/Aragorn item interactions.
- Reactivate battleground source.
- Reactivating still-active battleground.
- Activated/reactivated/re-reactivated battleground.
- Twice-recaptured battleground shields.
- Battleground ownership and "whose battleground."
- No battleground decks left.
- Choice when activating higher paths.
- No paths to activate in round 9.
- Activate path when current path is last path.
- Activating same-number or next-higher paths.
- Activating a new path through card play and immediate combat timing.
- There Is Another Way path swap.
- Active path clarification.
- No-card combat.
- Uncontested paths/battlegrounds.
- No fight, who wins.
- Combat ties/equalities.
- Duel-mode path combat tie.
- Path scoring in Two-player Duel.
- Different paths of same number scoring.
- Final path combat resolution.
- Battleground combat order.
- Remaining defenders after battle.
- Order of cycling cards during path/battleground combat.
- Leaders played to battleground without army.
- Armies with zero stats supporting characters.
- Two leaders, one army.
- Changing supporting army.
- Losing armies and leaders separately.
- Friendly support for Nazgul Warrior/Destroyer.
- Drawing when cycle/draw are empty.
- When to later recycle after running out.
- Recycle after Gandalf the White/Aragorn.
- Forsaking when draw pile empty.
- Forsake off top when deck empty.
- Drawing cards from cycle pile timing.
- Draw X, play Y, cycle rest and play cost.
- Event cards and cycling.
- Cost to play a card when directed by text.
- Searching actions and reveal requirements.
- Path/battleground deck inspection.
- Exact same character rule.
- Named character abilities more than once.
- Activate card text multiple times in one round.
- Lembas and zero corruption.
- Remove corruption at zero.
- Corruption path limits.
- Corruption in Duel scenarios.
- Grishnakh corruption placement.
- Morgai path corruption/attack text.
- Token placement clarification.
- Infinite corruption/combat tokens.
- Merry/Pippin battleground exception.
- Hobbits sent to battlegrounds.
- Red Arrow and Merry.
- Three Hunters support/play/move interactions.
- Balrog timing and double-trigger risk.
- Shelob clarification.
- Boromir forsake once or twice.
- Ioreth timing.
- Mouth of Sauron and Shadow battlegrounds.
- Lidless Eye and Shadow battlegrounds.
- Black Breath.
- Fell Beast.
- Black Riders Mount.
- Ringwraiths Are Abroad.
- Palantir with 0/1/2 cards.
- Palantir text and once-per-round usage.
- Galadriel draw/cycle timing.
- Mirror with forsaking/search secrecy.
- Phial changing path.
- Sam reserve action with items.
- Denethor question.
- Helm's Deep Rohan ability.
- Orthanc second part mandatory or optional.
- Morannon in Duel.
- Dol Guldur/Lorien mutual reactivation.

## Always-On Invariants

- Every card instance is in exactly one physical place.
- Physical places are player draw, hand, cycle, eliminated, reserve, active path, active battleground, or attachment list.
- No card can appear in two places.
- No card can disappear from all places.
- Every card instance references a known card definition.
- Every card definition owner and faction is valid.
- No unknown path or battleground IDs in state.
- Attached card must be an item.
- Attachment wielder must be a character.
- Attachment wielder must be in play.
- Attachment must match allowed wielder names.
- Attached item must not also be in any zone/location.
- If a wielder leaves play, attached items leave with it by eliminate/cycle/replacement rule.
- Item cycles to item owner's cycle pile, not necessarily wielder controller's pile.
- Active path is null or a legal active path.
- Active battleground is null or a legal active battleground.
- A path cannot be activated more than once per game.
- A location cannot be in deck, active area, and scoring area simultaneously.
- Scoring areas contain each location at most once.
- Round-local memory resets at new round.
- Round-local memory references known cards only.
- Cards played to reserve this round cannot move.
- Same character/item definition cannot be played twice in same round.
- Only active player can take normal action commands.
- Pending decisions are assigned to exactly one player or side.
- Rejected command leaves state hash unchanged.
- Accepted command records event(s) or an explicit no-op.
- Replaying event log from same seed yields same state hashes.
- Archive metadata hash must match rules/data/engine before trusting replay.
- Draw/cycle/eliminate/forsake never create or destroy cards.
- Search/take effects preserve card multiset and reshuffle when required.
- Scores never go below zero.
- Corruption never goes below zero.
- Tokens are attached to valid target cards or locations.
- Tokens leave/reset when target leaves if rules require.
- Combat resolution consumes each pending combat exactly once.
- Combat cannot score the same active location twice.
- Current phase and pending decision type agree.
- Action-step pass state is cleared correctly when a player acts again or new round starts.
- Hidden zones are not exposed in public view model.
- Public logs do not reveal unrevealed hidden cards.
- Storage load normalizes missing optional state fields.

## Fuzz And Property Testing Strategy

- Use stateful property tests over command sequences.
- Generate commands from current legal affordances 80-90 percent of the time.
- Generate intentionally illegal commands 10-20 percent of the time.
- Assert illegal commands return typed rule violations and preserve state hash.
- Assert every accepted command satisfies all invariants.
- Persist every failing generated sequence as a compact archive fixture.
- Shrink failures by deleting commands first, then simplifying command arguments.
- Use deterministic seed strings for every fuzz run.
- Add quick CI fuzz: 50 seeds times 50 commands.
- Add nightly/deep fuzz: thousands of seeds times 200+ commands.
- Bias seeds toward edge states: one-card hand, empty hand, empty draw, empty cycle, empty draw plus nonempty cycle.
- Bias seeds toward all players at/above/below carryover.
- Bias seeds toward path 9, no eligible paths, no battleground decks, and reactivation from scoring area.
- Bias seeds toward huge reserve and hand full of items.
- Bias seeds toward attached items across owner/controller boundaries.
- Bias seeds toward many supports on same battleground.
- Bias seeds toward zero-icon and token-heavy combats.
- Generate by phase/pending decision, not by flat random action.
- Model commands as `Command -> Accepted(Event[]) | Rejected(RuleViolation) | PendingDecision`.
- Build an independent oracle for card multiset, active player, phase, pending decision, and rough zone counts.
- Do not let the oracle duplicate detailed implementation logic.
- Use metamorphic checks: serialize/reload mid-game must not change future replay.
- Use metamorphic checks: archive replay from seed must equal incremental state.
- Use metamorphic checks: checkpoint replay must equal full replay from seed.
- Use metamorphic checks: public view must be a redaction of private state.
- Exhaustively enumerate small combat states with 0-4 attackers/defenders/tokens/items/supports.
- Use exhaustive legality matrix for every card against every path number and battleground.
- Use card-effect templates for generated tests: draw/play/cycle-rest, search, attach item, replacement effect, path activation, battleground reactivation, token add, corruption add/remove, reserve action.
- Use BGG URL titles as named regression IDs.
- Require every ambiguity fixture to record source URL, local rules/card lines, decision, and confidence.
- Run old archive fixtures after every engine change; changed hashes require intentional metadata/version bump.

## Next Implementation Plan

1. Merge the rules-kernel foundation PR.
2. Add formal event types instead of string event labels.
3. Add pending-decision state for forsake, casualty choice, draw/play/cycle-rest, search, and optional effects.
4. Model scoring areas, path activation history, and battleground activation/reactivation source.
5. Implement location activation text as scripted effects.
6. Implement scenario definitions for Trilogy, Duel, Three-player Duel, and Fellowship.
7. Implement visibility-aware view models.
8. Implement item ownership/control semantics.
9. Implement support assignment as an explicit combat decision.
10. Rework combat into a pending-decision flow.
11. Implement corruption and token targets.
12. Implement replacement effects for cycle-instead/eliminate-instead cases.
13. Implement reserve action framework and once-per-round/once-per-game counters.
14. Add card-effect template engine for common draw/search/play/cycle/forsake patterns.
15. Convert every BGG-derived ambiguity into a named regression fixture.
16. Add property-based fuzz runner with archive output for failures.
17. Add CI smoke fuzz and nightly deep fuzz workflows.
