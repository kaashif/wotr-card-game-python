# BGG thread search triage

Research date: 2026-07-06

Method: searched exact thread-title keywords and avoided opening BGG thread pages. Search snippets often expose only the thread title, but a few results expose enough surrounding text to prioritize test cases. Official/Dized rules pages and indexed PDFs were used only to cross-check the adjacent rules language.

## Search-result access quality

- BGG thread pages are indexed, but most result snippets expose only title, forum metadata, and product chrome.
- Some BGG results expose one useful sentence from the discussion; these are good candidates for direct browser-session scraping later.
- Official rule mirrors expose enough text to validate the rule side of several ambiguity tests without needing BGG post bodies.

## High-value candidates from snippets

- Last-card play cost.
  - Thread: `https://boardgamegeek.com/thread/2954283/playing-your-last-card`
  - Search snippets confirm the ambiguity is specifically about playing the last card. Dized states that every played card cycles a different hand card, and if it is the last hand card, the player must forsake instead.
  - Test angle: one-card hand with cards available to forsake; one-card hand with no draw/cycle left.

- Reserve item legality and movement.
  - Threads:
    - `https://boardgamegeek.com/thread/3023399/do-items-played-to-reserve-have-move-restriction`
    - `https://boardgamegeek.com/thread/3052983/moving-items-from-reserve`
    - `https://boardgamegeek.com/thread/3114689/item-cards-and-gandalfaragorn`
    - `https://boardgamegeek.com/thread/2951361/does-playing-an-item-on-an-active-character-in-the`
  - Search snippets confirm repeated ambiguity around items, reserve, and whether an item changes a character's active/movable state.
  - Test angle: items are legal reserve plays, illegal direct location plays, and later should move only to eligible wielders.

- Reactivating battlegrounds.
  - Threads:
    - `https://boardgamegeek.com/thread/3017468/reactivate-battleground`
    - `https://boardgamegeek.com/thread/3004758/reactivating-battlegrounds-still-active`
    - `https://boardgamegeek.com/thread/2958167/activated-re-activated-and-then-re-activated-again`
  - Search snippets expose a useful rule interpretation: reactivation is generally from an opponent's score pile and can swing victory points if won. Dized says reactivation takes a battleground from a scoring area and resolves activation text again; attackers/defenders do not change.
  - Test angle: reactivation source must be scoring area, not arbitrary deck lookup; activation text resolves again; side/faction roles stay fixed.

- Shadowfax destination scope.
  - Thread: `https://boardgamegeek.com/thread/2989472/does-shadowfax-only-allow-gandalf-to-move-to-a-wiz`
  - Search snippets expose the core ambiguity in the title only. Local card text says Shadowfax may reactivate any battleground and then must move Gandalf there.
  - Test angle: once card actions exist, Shadowfax should not restrict the selected battleground to Wizard battlegrounds.

- "When played or moved" timing.
  - Threads:
    - `https://boardgamegeek.com/thread/3002273/when-played-or-moved-text-does-it-apply-twice`
    - `https://boardgamegeek.com/thread/3023610/timing-on-balrog-of-moria-card`
    - `https://boardgamegeek.com/thread/3037230/shelob-clarification`
  - Search snippets expose the ambiguous phrase and the affected cards. Indexed rule/card text confirms Balrog/Shelob-style effects trigger when played or moved to a path or battleground.
  - Test angle: trigger exactly once per qualifying play or move event, not once for play plus once for the resulting zone.

- Activating a new path mid-round.
  - Threads:
    - `https://boardgamegeek.com/thread/3054587/when-activating-a-new-path-through-card-play-do-yo`
    - `https://boardgamegeek.com/thread/3121693/activate-a-path-of-the-next-higher-number`
    - `https://boardgamegeek.com/thread/3300013/eliminate-clarification`
  - Search snippets and review/rule summaries indicate that activating a new path during the action phase immediately resolves the current path battle, then activates the next eligible path.
  - Test angle: path scoring should happen before swapping the active path, and card text ordering matters if the acting card leaves play.

## Practical next step

For richer BGG text, use the Firefox userscript against search/result pages and then run exact-title web searches for the shortlist above. The search engine can prioritize candidates, but it does not reliably expose full first posts.
