# War of the Ring: The Card Game ambiguity test cases

Research date: 2026-07-06

BGG pages did not expose readable post bodies in this environment, so these cases are based on accessible search metadata, thread titles, snippets, and the local card reference data.

## Implemented regression tests

- Reserve items: BGG has rules discussion around whether items played to reserve have move restrictions. The local card reference includes item text that explicitly works from reserve, so `canPlayTo(..., "reserve")` should allow item cards while still rejecting direct item plays to paths or battlegrounds.
  - Source: https://boardgamegeek.com/thread/3023399/do-items-played-to-reserve-have-move-restriction
  - Related source: https://boardgamegeek.com/thread/3052983/moving-items-from-reserve

- Last hand card with draw deck: BGG has rules discussion around playing the last card in hand. The engine should use the existing fallback cost: if there is no different hand card to cycle, forsake the top card of the draw deck.
  - Source: https://boardgamegeek.com/thread/2954283/playing-your-last-card

- Absolute final card: the same last-card ambiguity includes the edge case where no hand, draw, or cycle card can pay a cost. The engine currently treats the play as legal and performs no extra cost movement.
  - Source: https://boardgamegeek.com/thread/2954283/playing-your-last-card

## Good next tests once the engine exposes these mechanics

- Shadowfax battleground scope: verify that Shadowfax can reactivate any battleground and then must move Gandalf there, instead of limiting the destination to Wizard battlegrounds.
  - Local card text: `shadowfax-86`
  - Source: https://boardgamegeek.com/thread/2989472/does-shadowfax-only-allow-gandalf-to-move-to-a-wiz

- "When played or moved" effects: verify that Balrog/Shelob-style effects trigger on each qualifying play or move event, but only from the event that actually moved or played the card to a path or battleground.
  - Local card text: `balrog-118`, `shelob-123`
  - Source: https://boardgamegeek.com/thread/3002273/when-played-or-moved-text-does-it-apply-twice
  - Related source: https://boardgamegeek.com/thread/3023610/timing-on-balrog-of-moria-card
  - Related source: https://boardgamegeek.com/thread/3037230/shelob-clarification

- Merry/Pippin battleground exceptions: verify that Merry and Pippin can be played or moved to their special battlegrounds only when supported by the matching army condition.
  - Local card text: `merry-brandybuck-70`, `pippin-took-71`
  - Source: https://boardgamegeek.com/thread/3230269/merry-and-pippin-game-text-clarification
  - Related source: https://boardgamegeek.com/thread/3337122/can-hobbits-be-sent-to-battlegrounds

- Reserve item movement to wielders: verify item movement from reserve when the wielder is in reserve versus already active, especially if the printed restriction appears to conflict with generic reserve movement rules.
  - Source: https://boardgamegeek.com/thread/3052983/moving-items-from-reserve
  - Related source: https://boardgamegeek.com/thread/3114689/item-cards-and-gandalfaragorn
