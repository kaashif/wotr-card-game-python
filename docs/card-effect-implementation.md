# Card Effect Implementation Checklist

This is the explicit per-card backend implementation checklist. Keep this list
in sync with `src/cardEffectScripts.ts`: a card is checked only when its rules
text has an executable script or an explicit `none` script for cards with no
rules text.

First implementation pass:

- All 124 cards have an implementation registry record.
- Cards with no rules text are implemented as explicit no-op scripts.
- Common automatic/resolution templates now have typed scripts and interpreter
  support: draw, corruption, path attack/defense tokens, pending forsake/search
  decisions, draw/play/cycle-rest decisions, carryover modifiers, and
  cycle-instead replacement declarations.
- Remaining unchecked cards below still need exact card-specific executable
  behavior or deeper timing/choice handling before they should be checked off.

## aragorn

- [ ] `dead-man-of-dunharow-33` Dead man of Dunharow (army) - TODO - + 2 Attack and + 2 defense tokens when I22supporting Strider or Aragorn
- [ ] `knights-of-dol-amroth-34` Knights of Dol Amroth (army) - TODO - *= + 1 Defense token on Dol Amroth
- [ ] `guards-of-the-citadel-35` Guards of the Citadel (army) - TODO - *= + 1 Defense token on Minas Tirith
- [ ] `soldiers-of-gondor-36` Soldiers of Gondor (army) - TODO - No rules text.
- [ ] `the-greatt-gate-37` The Greatt Gate (army) - TODO - * = +3 Defense token on Minas Tirith. This card can never played or moved to a Shadow battleground.
- [ ] `aragorn-38` Aragorn (character) - TODO - When played remove Strider from the game. While in reserve draw +1 card in the Draw step. If forsaken from top of the draw deck, cycle instead.
- [ ] `boromir-39` Boromir (character) - TODO - When played draw 1 card. When played or moved to a path, you MUST forsake 1 card.
- [ ] `denethor-40` Denethor (character) - TODO - If in reserve, you may use your action and forsake 1 card to take Boromir OR Faramir from your draw deck into hand
- [ ] `faramir-41` Faramir (character) - TODO - If played or moved to a path 7, you may activate a different path of the same #
- [ ] `halbarad-42` Halbarad (character) - TODO - If in reserve, you may use your action and cycle this card to take Strider OR Aragorn from your draw deck into hand
- [ ] `prince-imrahil-43` Prince Imrahil (character) - TODO - When played you may cycle 1 card from handto take Knights of Dol Amroth from the draw deck into hand
- [ ] `strider-44` Strider (character) - TODO - If on a path 7, you may use your action to activate a path of the next higher #. If Aragorn is played remove Strider from the game.
- [ ] `ioreth-45` Ioreth (character) - TODO - After combat on a battleground, Ioreth is cycled with 1 other non-Wizard character instead of being eliminated. Any wielded items ARE eliminated.
- [ ] `anduril-46` Anduril (item) - TODO - If in reserve, you may use your action to (re)activate any Dunedain battleground, then you MUST move the wielder (active or not) to that battelground.
- [ ] `blade-of-westernesse-47` Blade of Westernesse (item) - TODO - No rules text.
- [ ] `paths-of-the-dead-48` Paths of the Dead (event) - TODO - Forsake 2 cards and then draw 4 cards (or 5 if Strider/ Aragorn is in play).
- [ ] `the-red-arrow-49` The Red Arrow (event) - TODO - This Round Rohan cards may be played on Dunedain battlegrounds
- [ ] `the-three-hunters-50` The three Hunters (event) - TODO - This Round Strider/Aragorn, Gimli and Legolas may be moved or played on any battleground and supported by any FP army.
- [ ] `high-elves-51` High Elves (army) - TODO - No rules text.
- [ ] `high-elves-52` High Elves (army) - TODO - No rules text.
- [ ] `arwen-53` Arwen (character) - TODO - When played draw 1 card. While in reserve, add 1 Defense Token to Strider or Aragorn on a path or battleground
- [ ] `elrond-54` Elrond (character) - TODO - When played draw 1 card. While in reserve increase your carryover limit by 1.
- [ ] `galadriel-55` Galadriel (character) - TODO - When played draw 1 card. While in reserve draw +1 card in the Draw step, then cycle 1 card from hand.
- [ ] `legolas-56` Legolas (character) - TODO - When played you may take the Bow of Galadhrim from your draw deck into hand.
- [ ] `bow-of-galadhrim-57` Bow of Galadhrim (item) - TODO - The wielder of this card can not wield another weapon.
- [ ] `elven-cloak-58` Elven Cloak (item) - TODO - If its wielder is eliminated in PATH combat, cycle the wielder instead along with any wielded items
- [ ] `lembas-59` Lembas (item) - TODO - If on a path, the Hobbit player may use an action to eliminate this card to remove 1 corruption token for each Hobbit character on the path
- [ ] `mirror-of-galadriel-60` Mirror of Galadriel (item) - TODO - While in play, you may alway examine the top card of your draw deck
- [ ] `nenya-ring-of-adamant-61` Nenya, Ring of Adamant (item) - TODO - If in reserve, you may use your action and cycle this card to add 1 Defense token to the active path OR an active battleground
- [ ] `phial-of-galadriel-62` Phial of Galadriel (item) - TODO - If on a path, add 2 Defense tokens to the path
- [ ] `vilya-ring-of-air-63` Vilya, Ring of Air (item) - TODO - If in reserve, you may use your action and cycle this card so that each FP player draws 1 card.

## frodo

- [ ] `gimli-67` Gimli (character) - TODO - When played you may take "Dwarevn Axe" from your cycle pile into your hand
- [ ] `dwarven-axe-68` Dwarven Axe (item) - TODO - No rules text.
- [ ] `frodo-baggins-69` Frodo Baggins (character) - TODO - If eliminated or being forsaken, cycle instead (any wielded items ARE eliminated).
- [ ] `merry-brandybuck-70` Merry Brandybuck (character) - TODO - May be played or moved to a Rohan battleground supported by a Rohan army. If eliminated in PATH combat, cycle instead and any wielded items
- [ ] `pippin-took-71` Pippin Took (character) - TODO - May be played or moved to a Dunedain battleground supported by a Dunedain army. If eliminated in PATH combat, cycle instead and any wielded items
- [ ] `sam-gamgee-72` Sam Gamgee (character) - TODO - If in reserve, you may use your action and cycle this card (+ any with wielded items) to add 1 Defense token to the active path
- [ ] `bilbo-baggins-73` Bilbo Baggins (character) - TODO - If eliminated or being forsaken, cycle instead and any wielded items. If in reserve you may use your action and cycle this card to draw 2 cards.
- [ ] `fatty-bolger-74` Fatty Bolger (character) - TODO - If in reserve and when forsaken, cycle instead and any wielded items. If in reserve you may use your action and eliminate this card to draw 3 cards.
- [ ] `herbs-stewed-rabbit-75` Herbs & stewed Rabbit (item) - TODO - If in play, you may use your action and eliminate this card to take 1 Hobbit Character from the cycle pile into your hand and draw 1 card
- [ ] `sting-76` Sting (item) - TODO - If the wielder is on a path with a Monstrous Character then add 1 Defense token to the active path
- [ ] `mithril-coat-77` Mithril Coat (item) - TODO - No rules text.
- [ ] `there-is-another-way-78` There is another way (event) - TODO - Activate and select a different path with the same number as the active path and add 1 Defense token to the new path
- [ ] `riders-of-rohan-79` Riders of Rohan (army) - TODO - No rules text.
- [ ] `riders-of-rohan-80` Riders of Rohan (army) - TODO - No rules text.
- [ ] `village-militia-81` Village Militia (army) - TODO - No rules text.
- [ ] `eomer-82` Eomer (character) - TODO - When played draw 5 cards; from these play up to 1 Rohan army and cycle the rest
- [ ] `eowyn-83` Eowyn (character) - TODO - When played to a battleground you may eliminate 1 Nazgul character. When played to reserve you may take Merry or Pippin from cycle pile into hand.
- [ ] `ghan-buri-ghan-84` Ghan-Buri-Ghan (character) - TODO - While in reserve, Rohan cards may be played or moved to Minas Tirith
- [ ] `theoden-85` Theoden (character) - TODO - *= +1 if Gandalf is in play. When played draw 5 cards; from these play up to 1 Rohan card and cycle the rest
- [ ] `shadowfax-86` Shadowfax (item) - TODO - While in reserve, you may use your action to (re)activate any battleground, then you MUST move the wielder (Gandalf) to that battleground
- [ ] `death-ride-ride-to-ruin-87` Death! Ride, ride to ruin (event) - TODO - Eliminate any number of Rohan cards in reserve; the Mordor player must then eliminate the same number of Mordor cards from active battlegrounds
- [ ] `gandalf-the-grey-88` Gandalf the Grey (character) - TODO - If on a path, you may use your action to activate a path of the next higher #. If GtW is played, eliminate GtG
- [ ] `gandalf-the-white-89` Gandalf the White (character) - TODO - When played remove GtG from the game; While in reserve draw +1 card in each Draw step. If forsaken from top of the draw deck, cycle instead
- [ ] `treebeard-ent-90` Treebeard (Ent) (character) - TODO - * = +1 on Orthanc. If played/moved to a battleground Isengard player must eliminate 1 Isengard army
- [ ] `quickbeam-ent-91` Quickbeam (Ent) (character) - TODO - * = 1 for every 2 Isengard Character/Armies on the same battleground
- [ ] `smeagol-92` Smeagol (character) - TODO - If on a path, you may use your action to activate a path of the next higher #; add 1 corruption token. If eliminated in PATH combat, cycle instead
- [ ] `gwaihir-the-windlord-93` Gwaihir the Windlord (character) - TODO - If in reserve, you may use your action to cycle this card to take Gandalf from your cycle pile into hand
- [ ] `gandalfs-staff-94` Gandalfs Staff (item) - TODO - While in play increase your carryover limit by 1
- [ ] `glamdring-95` Glamdring (item) - TODO - No rules text.
- [ ] `narya-ring-of-fire-96` Narya, Ring of Fire (item) - TODO - If in reserve, you may use your action and cycle this card so that each Shadow player must cycle 1 card from hand
- [ ] `ent-draught-97` Ent-draught (item) - TODO - If in play, you may use your action and eliminate this card to take 2 Hobbit Characters from the cycle pile into hand

## saruman

- [ ] `devilry-of-satruman-101` Devilry of Satruman (army) - TODO - No rules text.
- [ ] `fighting-uruk-hai-102` Fighting Uruk-Hai (army) - TODO - No rules text.
- [ ] `wolf-riders-103` Wolf Riders (army) - TODO - No rules text.
- [ ] `white-hand-orcs-104` White Hand Orcs (army) - TODO - No rules text.
- [ ] `white-hand-orcs-105` White Hand Orcs (army) - TODO - No rules text.
- [ ] `grima-wormtongue-106` Grima Wormtongue (character) - TODO - If in reserve you may use your action and eliminate this card to either take Saruman from the draw deck in hand or eliminate a Rohan Character
- [ ] `saruman-107` Saruman (character) - TODO - While in reserve draw +1 card in the Draw step. If forsaken from top of the draw deck, cycle instead.
- [ ] `ugluk-108` Ugluk (character) - TODO - If on a path you may use your action to activate a different path of the same #
- [ ] `palantir-109` Palantir (item) - TODO - If in reserve, once per Round you may use your action to examine the top 3 cards of the draw deck; from these elminate 1, cycle 1 and take 1 in hand
- [ ] `saruman-s-staff-110` Saruman's Staff (item) - TODO - While in play increase your carryover limit by 1
- [ ] `woven-of-all-colours-111` Woven of all colours (item) - TODO - If the wielder (Saruman) is eliminated in combat, cycle instead along with any wielded items
- [ ] `threats-and-promises-112` Threats and Promises (event) - TODO - If Saruman is in reserve (active or not), (re)activate any Isengard battleground of your choice, then you MAY move Saruman to that battleground
- [ ] `goblins-misty-mountains-113` Goblins Misty Mountains (army) - TODO - No rules text.
- [ ] `goblins-misty-mountains-114` Goblins Misty Mountains (army) - TODO - No rules text.
- [ ] `barrow-wights-115` Barrow-Wights (character) - TODO - If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [ ] `flocks-of-crebain-116` Flocks of Crebain (character) - TODO - If on a path you may use your action to activate a different path of the same #.
- [ ] `hill-troll-117` Hill Troll (character) - TODO - If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [ ] `balrog-118` Balrog (character) - TODO - *= +1 on Khazad-Dum. When played or moved to a path or battleground each FP player must forsake 1 card
- [ ] `caradhras-119` Caradhras (character) - TODO - When played on Caradhras, activate a different path of the same #. If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [ ] `cave-troll-120` Cave Troll (character) - TODO - If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [ ] `candles-of-corpses-121` Candles of Corpses (character) - TODO - *= on Dead Marshes. If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [ ] `gollum-122` Gollum (character) - TODO - If on a path you may use your action to activate a different path of the same #. If Gollum is eliminated in path combat, cycle nstead
- [ ] `shelob-123` Shelob (character) - TODO - *= +1 on Shelob's Lair.When played or moved to a path or battleground each FP player must forsake 1 card
- [ ] `whip-of-many-thongs-124` Whip of many Thongs (item) - TODO - When played, draw 1 card.
- [ ] `haradrim-mumakil-125` Haradrim Mumakil (army) - TODO - No rules text.
- [ ] `coastal-raiders-126` Coastal Raiders (army) - TODO - *= +1 on Dol Amroth battleground. If in reserve you may use your action and eliminate this card to activate Dol Amroth if in FP battleground deck
- [ ] `haradrim-cavalry-127` Haradrim Cavalry (army) - TODO - *= +1 on Minas Tirith battleground. If in reserve you may use your action and eliminate this card to activate Minas Tirith if in FP battleground deck
- [ ] `the-black-fleet-128` The Black Fleet (army) - TODO - *= +1 on Pelargir battleground. If in reserve you may use your action and eliminate this card to activate Pelargir if in FP battleground deck
- [ ] `corsairs-of-umbar-129` Corsairs of Umbar (army) - TODO - If in reserve you may use your action and eliminate this card to activate Umbar if in Shadows player battleground deck
- [ ] `haradrim-regulars-130` Haradrim Regulars (army) - TODO - If in reserve you may use your action and eliminate this card to activate Harad if in Shadows player battleground deck
- [ ] `the-black-serpent-131` The Black Serpent (character) - TODO - If in reserve you may use your action and eliminate this card to reactivate any Southron battleground

## witchKing

- [ ] `grond-hammer-underworld-135` Grond, hammer underworld (army) - TODO - No rules text.
- [ ] `olog-hai-136` Olog-Hai (army) - TODO - No rules text.
- [ ] `trolls-of-udun-137` Trolls of Udun (army) - TODO - No rules text.
- [ ] `black-uruks-138` Black Uruks (army) - TODO - No rules text.
- [ ] `mordor-orcs-139` Mordor Orcs (army) - TODO - No rules text.
- [ ] `mordor-orcs-140` Mordor Orcs (army) - TODO - No rules text.
- [ ] `mordor-orcs-141` Mordor Orcs (army) - TODO - No rules text.
- [ ] `mordor-orcs-142` Mordor Orcs (army) - TODO - No rules text.
- [ ] `mordor-orcs-143` Mordor Orcs (army) - TODO - No rules text.
- [ ] `the-witch-king-nazgul-144` The Witch-King (Nazgul) (character) - TODO - While in reserve draw +1 card in the draw step. If forsaken from top of the draw deck, cycle instead.
- [ ] `the-reaver-nazgul-145` The Reaver (Nazgul) (character) - TODO - If in reserve you may use your action and cycle this card so that each FP player must forsake 1 card
- [ ] `the-beguiler-nazgul-146` The Beguiler (Nazgul) (character) - TODO - If in reserve you may use your action and cycle this card so that each FP player must cycle 1 card from hand
- [ ] `the-hunter-nazgul-147` The Hunter (Nazgul) (character) - TODO - If in reserve you may use your action and cycle this card to add 1 Attack token to an active path
- [ ] `the-messenger-nazgul-148` The Messenger (Nazgul) (character) - TODO - If in reserve you may use your action and cycle this card to take a Nzagul character from the cycle pile into hand
- [ ] `the-black-easterling-nazgul-149` The Black Easterling (Nazgul) (character) - TODO - *= +1 Defense token on Dol Guldur. When played draw 1 card.
- [ ] `the-commander-nazgul-150` The Commander (Nazgul) (character) - TODO - If in reserve you may use your action and cycle this card so that each Shadow player draws 1 card
- [ ] `the-destroyer-nazgul-151` The Destroyer (Nazgul) (character) - TODO - If in reserve you may use your action and cycle this card to add 1 Attack token to an active battleground
- [ ] `the-warrior-nazgul-152` The Warrior (Nazgul) (character) - TODO - If in reserve you may use your action and cycle this card to add 1 Defense token to an active battleground
- [ ] `grishnakh-153` Grishnakh (character) - TODO - When on a path you may use your action and eliminate this card to add 1 corruption token
- [ ] `mouth-of-sauron-154` Mouth of Sauron (character) - TODO - This card can not be played or moved to a path if a Shadow battleground is active. While in reserve draw +1 card in the draw step.
- [ ] `gorbag-shagrat-155` Gorbag & Shagrat (character) - TODO - *= When played or moved to a path you may cycle 1 card from hand to add 1 attack token or 2 tokens if Cirith Ungol is the active path
- [ ] `the-lidless-eye-156` The Lidless Eye (character) - TODO - Cannot be played/moved to a path if a SP-battleground is active.When played each SP draws 1 card. While in reserve increase your COL by 1
- [ ] `gothmog-157` Gothmog (character) - TODO - While in reserve draw +1 card in the draw step. When played remove the Witch-King from the game.
- [ ] `nazguls-mantle-158` Nazguls Mantle (item) - TODO - If its Nazgul is eliminated in combat, cycle it instead along with any wielded items
- [ ] `black-breath-159` Black Breath (item) - TODO - If on a path or battleground you may use your action and cycle this card, its Nazgul and any wielde items to add 1 corruption token
- [ ] `black-riders-mount-160` Black Riders Mount (item) - TODO - When played on a Nazgul in reserve (active or not), you may immediately move them to a path
- [ ] `fell-beast-161` Fell Beast (item) - TODO - When played on a Nazgul in reserve (active or not), you may immediately move them to a battleground
- [ ] `morgul-blade-162` Morgul Blade (item) - TODO - If on a path you may use your action and eliminate this card to add 1 corruption token
- [ ] `the-black-captain-163` The Black Captain (event) - TODO - If the Witch-King is in reserve (active or not), (re)activate any Mordor battleground, then you MAY move the Witch-King to this battleground
- [ ] `the-ringwraiths-are-abroad-164` The Ringwraiths are abroad (event) - TODO - Draw 7 cards, eliminate 1 and play up to 2 Nazgul Characters, cycle the rest
- [ ] `the-day-without-dawn-165` The Day without Dawn (event) - TODO - Draw 7 cards, eliminate 1 and play up to 2 armies, cycle the rest
