# Card Effect Implementation Checklist

This is the explicit per-card backend implementation checklist. Keep this list
in sync with `src/cardEffectScripts.ts`: a card is checked when its rules text
has a typed script record, or an explicit no-op script for cards with no rules
text.

First implementation pass:

- All 124 cards have an implementation registry record.
- Cards with no rules text are implemented as explicit no-op scripts.
- Common automatic/resolution templates have typed scripts and interpreter
  support: draw, corruption, path attack/defense tokens, pending forsake/search
  decisions, draw/play/cycle-rest decisions, carryover modifiers, and
  cycle-instead replacement declarations.
- Combat modifiers, legal-play restrictions, round rules, and replacement
  effects now have runtime consumers in the game kernel. Complex optional
  choices that require UI selection still become pending decisions when the
  current engine cannot resolve them automatically.
- There are no remaining `todo` card-effect records in the registry.

## aragorn

- [x] `dead-man-of-dunharow-33` Dead man of Dunharow (army) - scripted - + 2 Attack and + 2 defense tokens when I22supporting Strider or Aragorn
- [x] `knights-of-dol-amroth-34` Knights of Dol Amroth (army) - scripted - *= + 1 Defense token on Dol Amroth
- [x] `guards-of-the-citadel-35` Guards of the Citadel (army) - scripted - *= + 1 Defense token on Minas Tirith
- [x] `soldiers-of-gondor-36` Soldiers of Gondor (army) - scripted - No rules text.
- [x] `the-greatt-gate-37` The Greatt Gate (army) - scripted - * = +3 Defense token on Minas Tirith. This card can never played or moved to a Shadow battleground.
- [x] `aragorn-38` Aragorn (character) - scripted - When played remove Strider from the game. While in reserve draw +1 card in the Draw step. If forsaken from top of the draw deck, cycle instead.
- [x] `boromir-39` Boromir (character) - scripted - When played draw 1 card. When played or moved to a path, you MUST forsake 1 card.
- [x] `denethor-40` Denethor (character) - scripted - If in reserve, you may use your action and forsake 1 card to take Boromir OR Faramir from your draw deck into hand
- [x] `faramir-41` Faramir (character) - scripted - If played or moved to a path 7, you may activate a different path of the same #
- [x] `halbarad-42` Halbarad (character) - scripted - If in reserve, you may use your action and cycle this card to take Strider OR Aragorn from your draw deck into hand
- [x] `prince-imrahil-43` Prince Imrahil (character) - scripted - When played you may cycle 1 card from handto take Knights of Dol Amroth from the draw deck into hand
- [x] `strider-44` Strider (character) - scripted - If on a path 7, you may use your action to activate a path of the next higher #. If Aragorn is played remove Strider from the game.
- [x] `ioreth-45` Ioreth (character) - scripted - After combat on a battleground, Ioreth is cycled with 1 other non-Wizard character instead of being eliminated. Any wielded items ARE eliminated.
- [x] `anduril-46` Anduril (item) - scripted - If in reserve, you may use your action to (re)activate any Dunedain battleground, then you MUST move the wielder (active or not) to that battelground.
- [x] `blade-of-westernesse-47` Blade of Westernesse (item) - scripted - No rules text.
- [x] `paths-of-the-dead-48` Paths of the Dead (event) - scripted - Forsake 2 cards and then draw 4 cards (or 5 if Strider/ Aragorn is in play).
- [x] `the-red-arrow-49` The Red Arrow (event) - scripted - This Round Rohan cards may be played on Dunedain battlegrounds
- [x] `the-three-hunters-50` The three Hunters (event) - scripted - This Round Strider/Aragorn, Gimli and Legolas may be moved or played on any battleground and supported by any FP army.
- [x] `high-elves-51` High Elves (army) - scripted - No rules text.
- [x] `high-elves-52` High Elves (army) - scripted - No rules text.
- [x] `arwen-53` Arwen (character) - scripted - When played draw 1 card. While in reserve, add 1 Defense Token to Strider or Aragorn on a path or battleground
- [x] `elrond-54` Elrond (character) - scripted - When played draw 1 card. While in reserve increase your carryover limit by 1.
- [x] `galadriel-55` Galadriel (character) - scripted - When played draw 1 card. While in reserve draw +1 card in the Draw step, then cycle 1 card from hand.
- [x] `legolas-56` Legolas (character) - scripted - When played you may take the Bow of Galadhrim from your draw deck into hand.
- [x] `bow-of-galadhrim-57` Bow of Galadhrim (item) - scripted - The wielder of this card can not wield another weapon.
- [x] `elven-cloak-58` Elven Cloak (item) - scripted - If its wielder is eliminated in PATH combat, cycle the wielder instead along with any wielded items
- [x] `lembas-59` Lembas (item) - scripted - If on a path, the Hobbit player may use an action to eliminate this card to remove 1 corruption token for each Hobbit character on the path
- [x] `mirror-of-galadriel-60` Mirror of Galadriel (item) - scripted - While in play, you may alway examine the top card of your draw deck
- [x] `nenya-ring-of-adamant-61` Nenya, Ring of Adamant (item) - scripted - If in reserve, you may use your action and cycle this card to add 1 Defense token to the active path OR an active battleground
- [x] `phial-of-galadriel-62` Phial of Galadriel (item) - scripted - If on a path, add 2 Defense tokens to the path
- [x] `vilya-ring-of-air-63` Vilya, Ring of Air (item) - scripted - If in reserve, you may use your action and cycle this card so that each FP player draws 1 card.

## frodo

- [x] `gimli-67` Gimli (character) - scripted - When played you may take "Dwarevn Axe" from your cycle pile into your hand
- [x] `dwarven-axe-68` Dwarven Axe (item) - scripted - No rules text.
- [x] `frodo-baggins-69` Frodo Baggins (character) - scripted - If eliminated or being forsaken, cycle instead (any wielded items ARE eliminated).
- [x] `merry-brandybuck-70` Merry Brandybuck (character) - scripted - May be played or moved to a Rohan battleground supported by a Rohan army. If eliminated in PATH combat, cycle instead and any wielded items
- [x] `pippin-took-71` Pippin Took (character) - scripted - May be played or moved to a Dunedain battleground supported by a Dunedain army. If eliminated in PATH combat, cycle instead and any wielded items
- [x] `sam-gamgee-72` Sam Gamgee (character) - scripted - If in reserve, you may use your action and cycle this card (+ any with wielded items) to add 1 Defense token to the active path
- [x] `bilbo-baggins-73` Bilbo Baggins (character) - scripted - If eliminated or being forsaken, cycle instead and any wielded items. If in reserve you may use your action and cycle this card to draw 2 cards.
- [x] `fatty-bolger-74` Fatty Bolger (character) - scripted - If in reserve and when forsaken, cycle instead and any wielded items. If in reserve you may use your action and eliminate this card to draw 3 cards.
- [x] `herbs-stewed-rabbit-75` Herbs & stewed Rabbit (item) - scripted - If in play, you may use your action and eliminate this card to take 1 Hobbit Character from the cycle pile into your hand and draw 1 card
- [x] `sting-76` Sting (item) - scripted - If the wielder is on a path with a Monstrous Character then add 1 Defense token to the active path
- [x] `mithril-coat-77` Mithril Coat (item) - scripted - No rules text.
- [x] `there-is-another-way-78` There is another way (event) - scripted - Activate and select a different path with the same number as the active path and add 1 Defense token to the new path
- [x] `riders-of-rohan-79` Riders of Rohan (army) - scripted - No rules text.
- [x] `riders-of-rohan-80` Riders of Rohan (army) - scripted - No rules text.
- [x] `village-militia-81` Village Militia (army) - scripted - No rules text.
- [x] `eomer-82` Eomer (character) - scripted - When played draw 5 cards; from these play up to 1 Rohan army and cycle the rest
- [x] `eowyn-83` Eowyn (character) - scripted - When played to a battleground you may eliminate 1 Nazgul character. When played to reserve you may take Merry or Pippin from cycle pile into hand.
- [x] `ghan-buri-ghan-84` Ghan-Buri-Ghan (character) - scripted - While in reserve, Rohan cards may be played or moved to Minas Tirith
- [x] `theoden-85` Theoden (character) - scripted - *= +1 if Gandalf is in play. When played draw 5 cards; from these play up to 1 Rohan card and cycle the rest
- [x] `shadowfax-86` Shadowfax (item) - scripted - While in reserve, you may use your action to (re)activate any battleground, then you MUST move the wielder (Gandalf) to that battleground
- [x] `death-ride-ride-to-ruin-87` Death! Ride, ride to ruin (event) - scripted - Eliminate any number of Rohan cards in reserve; the Mordor player must then eliminate the same number of Mordor cards from active battlegrounds
- [x] `gandalf-the-grey-88` Gandalf the Grey (character) - scripted - If on a path, you may use your action to activate a path of the next higher #. If GtW is played, eliminate GtG
- [x] `gandalf-the-white-89` Gandalf the White (character) - scripted - When played remove GtG from the game; While in reserve draw +1 card in each Draw step. If forsaken from top of the draw deck, cycle instead
- [x] `treebeard-ent-90` Treebeard (Ent) (character) - scripted - * = +1 on Orthanc. If played/moved to a battleground Isengard player must eliminate 1 Isengard army
- [x] `quickbeam-ent-91` Quickbeam (Ent) (character) - scripted - * = 1 for every 2 Isengard Character/Armies on the same battleground
- [x] `smeagol-92` Smeagol (character) - scripted - If on a path, you may use your action to activate a path of the next higher #; add 1 corruption token. If eliminated in PATH combat, cycle instead
- [x] `gwaihir-the-windlord-93` Gwaihir the Windlord (character) - scripted - If in reserve, you may use your action to cycle this card to take Gandalf from your cycle pile into hand
- [x] `gandalfs-staff-94` Gandalfs Staff (item) - scripted - While in play increase your carryover limit by 1
- [x] `glamdring-95` Glamdring (item) - scripted - No rules text.
- [x] `narya-ring-of-fire-96` Narya, Ring of Fire (item) - scripted - If in reserve, you may use your action and cycle this card so that each Shadow player must cycle 1 card from hand
- [x] `ent-draught-97` Ent-draught (item) - scripted - If in play, you may use your action and eliminate this card to take 2 Hobbit Characters from the cycle pile into hand

## saruman

- [x] `devilry-of-satruman-101` Devilry of Satruman (army) - scripted - No rules text.
- [x] `fighting-uruk-hai-102` Fighting Uruk-Hai (army) - scripted - No rules text.
- [x] `wolf-riders-103` Wolf Riders (army) - scripted - No rules text.
- [x] `white-hand-orcs-104` White Hand Orcs (army) - scripted - No rules text.
- [x] `white-hand-orcs-105` White Hand Orcs (army) - scripted - No rules text.
- [x] `grima-wormtongue-106` Grima Wormtongue (character) - scripted - If in reserve you may use your action and eliminate this card to either take Saruman from the draw deck in hand or eliminate a Rohan Character
- [x] `saruman-107` Saruman (character) - scripted - While in reserve draw +1 card in the Draw step. If forsaken from top of the draw deck, cycle instead.
- [x] `ugluk-108` Ugluk (character) - scripted - If on a path you may use your action to activate a different path of the same #
- [x] `palantir-109` Palantir (item) - scripted - If in reserve, once per Round you may use your action to examine the top 3 cards of the draw deck; from these elminate 1, cycle 1 and take 1 in hand
- [x] `saruman-s-staff-110` Saruman's Staff (item) - scripted - While in play increase your carryover limit by 1
- [x] `woven-of-all-colours-111` Woven of all colours (item) - scripted - If the wielder (Saruman) is eliminated in combat, cycle instead along with any wielded items
- [x] `threats-and-promises-112` Threats and Promises (event) - scripted - If Saruman is in reserve (active or not), (re)activate any Isengard battleground of your choice, then you MAY move Saruman to that battleground
- [x] `goblins-misty-mountains-113` Goblins Misty Mountains (army) - scripted - No rules text.
- [x] `goblins-misty-mountains-114` Goblins Misty Mountains (army) - scripted - No rules text.
- [x] `barrow-wights-115` Barrow-Wights (character) - scripted - If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [x] `flocks-of-crebain-116` Flocks of Crebain (character) - scripted - If on a path you may use your action to activate a different path of the same #.
- [x] `hill-troll-117` Hill Troll (character) - scripted - If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [x] `balrog-118` Balrog (character) - scripted - *= +1 on Khazad-Dum. When played or moved to a path or battleground each FP player must forsake 1 card
- [x] `caradhras-119` Caradhras (character) - scripted - When played on Caradhras, activate a different path of the same #. If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [x] `cave-troll-120` Cave Troll (character) - scripted - If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [x] `candles-of-corpses-121` Candles of Corpses (character) - scripted - *= on Dead Marshes. If in reserve you may use your action and eliminate this card so each FP player must forsake 1 card
- [x] `gollum-122` Gollum (character) - scripted - If on a path you may use your action to activate a different path of the same #. If Gollum is eliminated in path combat, cycle nstead
- [x] `shelob-123` Shelob (character) - scripted - *= +1 on Shelob's Lair.When played or moved to a path or battleground each FP player must forsake 1 card
- [x] `whip-of-many-thongs-124` Whip of many Thongs (item) - scripted - When played, draw 1 card.
- [x] `haradrim-mumakil-125` Haradrim Mumakil (army) - scripted - No rules text.
- [x] `coastal-raiders-126` Coastal Raiders (army) - scripted - *= +1 on Dol Amroth battleground. If in reserve you may use your action and eliminate this card to activate Dol Amroth if in FP battleground deck
- [x] `haradrim-cavalry-127` Haradrim Cavalry (army) - scripted - *= +1 on Minas Tirith battleground. If in reserve you may use your action and eliminate this card to activate Minas Tirith if in FP battleground deck
- [x] `the-black-fleet-128` The Black Fleet (army) - scripted - *= +1 on Pelargir battleground. If in reserve you may use your action and eliminate this card to activate Pelargir if in FP battleground deck
- [x] `corsairs-of-umbar-129` Corsairs of Umbar (army) - scripted - If in reserve you may use your action and eliminate this card to activate Umbar if in Shadows player battleground deck
- [x] `haradrim-regulars-130` Haradrim Regulars (army) - scripted - If in reserve you may use your action and eliminate this card to activate Harad if in Shadows player battleground deck
- [x] `the-black-serpent-131` The Black Serpent (character) - scripted - If in reserve you may use your action and eliminate this card to reactivate any Southron battleground

## witchKing

- [x] `grond-hammer-underworld-135` Grond, hammer underworld (army) - scripted - No rules text.
- [x] `olog-hai-136` Olog-Hai (army) - scripted - No rules text.
- [x] `trolls-of-udun-137` Trolls of Udun (army) - scripted - No rules text.
- [x] `black-uruks-138` Black Uruks (army) - scripted - No rules text.
- [x] `mordor-orcs-139` Mordor Orcs (army) - scripted - No rules text.
- [x] `mordor-orcs-140` Mordor Orcs (army) - scripted - No rules text.
- [x] `mordor-orcs-141` Mordor Orcs (army) - scripted - No rules text.
- [x] `mordor-orcs-142` Mordor Orcs (army) - scripted - No rules text.
- [x] `mordor-orcs-143` Mordor Orcs (army) - scripted - No rules text.
- [x] `the-witch-king-nazgul-144` The Witch-King (Nazgul) (character) - scripted - While in reserve draw +1 card in the draw step. If forsaken from top of the draw deck, cycle instead.
- [x] `the-reaver-nazgul-145` The Reaver (Nazgul) (character) - scripted - If in reserve you may use your action and cycle this card so that each FP player must forsake 1 card
- [x] `the-beguiler-nazgul-146` The Beguiler (Nazgul) (character) - scripted - If in reserve you may use your action and cycle this card so that each FP player must cycle 1 card from hand
- [x] `the-hunter-nazgul-147` The Hunter (Nazgul) (character) - scripted - If in reserve you may use your action and cycle this card to add 1 Attack token to an active path
- [x] `the-messenger-nazgul-148` The Messenger (Nazgul) (character) - scripted - If in reserve you may use your action and cycle this card to take a Nzagul character from the cycle pile into hand
- [x] `the-black-easterling-nazgul-149` The Black Easterling (Nazgul) (character) - scripted - *= +1 Defense token on Dol Guldur. When played draw 1 card.
- [x] `the-commander-nazgul-150` The Commander (Nazgul) (character) - scripted - If in reserve you may use your action and cycle this card so that each Shadow player draws 1 card
- [x] `the-destroyer-nazgul-151` The Destroyer (Nazgul) (character) - scripted - If in reserve you may use your action and cycle this card to add 1 Attack token to an active battleground
- [x] `the-warrior-nazgul-152` The Warrior (Nazgul) (character) - scripted - If in reserve you may use your action and cycle this card to add 1 Defense token to an active battleground
- [x] `grishnakh-153` Grishnakh (character) - scripted - When on a path you may use your action and eliminate this card to add 1 corruption token
- [x] `mouth-of-sauron-154` Mouth of Sauron (character) - scripted - This card can not be played or moved to a path if a Shadow battleground is active. While in reserve draw +1 card in the draw step.
- [x] `gorbag-shagrat-155` Gorbag & Shagrat (character) - scripted - *= When played or moved to a path you may cycle 1 card from hand to add 1 attack token or 2 tokens if Cirith Ungol is the active path
- [x] `the-lidless-eye-156` The Lidless Eye (character) - scripted - Cannot be played/moved to a path if a SP-battleground is active.When played each SP draws 1 card. While in reserve increase your COL by 1
- [x] `gothmog-157` Gothmog (character) - scripted - While in reserve draw +1 card in the draw step. When played remove the Witch-King from the game.
- [x] `nazguls-mantle-158` Nazguls Mantle (item) - scripted - If its Nazgul is eliminated in combat, cycle it instead along with any wielded items
- [x] `black-breath-159` Black Breath (item) - scripted - If on a path or battleground you may use your action and cycle this card, its Nazgul and any wielde items to add 1 corruption token
- [x] `black-riders-mount-160` Black Riders Mount (item) - scripted - When played on a Nazgul in reserve (active or not), you may immediately move them to a path
- [x] `fell-beast-161` Fell Beast (item) - scripted - When played on a Nazgul in reserve (active or not), you may immediately move them to a battleground
- [x] `morgul-blade-162` Morgul Blade (item) - scripted - If on a path you may use your action and eliminate this card to add 1 corruption token
- [x] `the-black-captain-163` The Black Captain (event) - scripted - If the Witch-King is in reserve (active or not), (re)activate any Mordor battleground, then you MAY move the Witch-King to this battleground
- [x] `the-ringwraiths-are-abroad-164` The Ringwraiths are abroad (event) - scripted - Draw 7 cards, eliminate 1 and play up to 2 Nazgul Characters, cycle the rest
- [x] `the-day-without-dawn-165` The Day without Dawn (event) - scripted - Draw 7 cards, eliminate 1 and play up to 2 armies, cycle the rest
