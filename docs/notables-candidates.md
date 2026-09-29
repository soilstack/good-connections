# Notable achievements — candidates

*A menu to choose from, not a plan. The league page currently shows five
"notable" awards and they are all infamous; these are options for balancing that
out and for widening the infamous side.*

**Everything here is computable from event logs already being recorded.** No new
events, no schema change, no migration. The field each award needs is named so
the cost is visible before choosing. Nothing below is built.

Current awards, for reference: most wrong guesses, most repeat picks, longest
stall between sets, most premature "done"s, most time lost to penalties, plus
most robotic / most chaotic.

## 'Good' notables

| Name | What it means | Needs |
|---|---|---|
| **Quickest off the mark** | Fastest first set of the season | `timeToFirstSetMs` |
| **Clean sheet** | Completed a board with zero wrong guesses | `errorCount === 0` |
| **Textbook sweep** | Solved in exact scan order, start to finish | `findOrderString().perfect` |
| **Metronome** | Most even pacing — smallest spread between consecutive finds | `setIntervalsMs` |
| **Negative split** | Second half of the board faster than the first — sped up rather than flagged | `setIntervalsMs` |
| **Strong finish** | Shortest final gap: closed it out instead of stalling on the last one | `setIntervalsMs` |
| **Cracked the wall** | Fastest to find the set most players stalled on that day | `matchHighlights` consensus |
| **Nerves of steel** *(Mode C)* | Shortest dithering — hit Done the moment they were finished | `ditheringMs` |
| **Never say die** | Longest run of days without giving up | `abandoned` across games |
| **Personal best** | Biggest improvement on their own previous best | `totalTimeMs` history |
| **Comeback** | Slowest first set, still won the day | `timeToFirstSetMs` + rank |

## More 'bad' notables

| Name | What it means | Needs |
|---|---|---|
| **Nearly quit** | Opened the give-up prompt the most times and carried on anyway | `abandonPrompts` |
| **Slow starter** | Longest time to find the very first set | `timeToFirstSetMs` |
| **So close** | Gave up with the most sets already found | `setsFound` + `abandoned` |
| **Bailed early** | Gave up fastest — shortest time before quitting | `totalTimeMs` + `abandoned` |
| **Blank** | Finished a game having found nothing at all | `setsFound === 0` |
| **Scattergun** | Worst error rate in a single game | `errorRate` |
| **Groundhog day** | Same set re-submitted the most times in one game | `duplicateCount` |
| **Dithering** *(Mode C)* | Longest sit on a finished board before pressing Done | `ditheringMs` |
| **Off day** | Slowest game relative to their own average | `totalTimeMs` vs mean |
| **The long goodbye** | Longest gap before finding the last set | `setIntervalsMs` |

`abandonPrompts` is worth singling out: it has been recorded since slice 1 and
nothing has ever read it. CLAUDE.md calls the near-miss out specifically — "a
player who opened the prompt at 4:32 and backed out is a more interesting data
point than one who never considered it" — so **Nearly quit** is the one award
here that redeems an existing measurement rather than adding a new reading of an
old one.

## The two design questions

**Balance.** Roughly even between good and bad. An all-infamous list gets mean if
someone is genuinely struggling; an all-positive one is bland. A mix means most
people appear somewhere most weeks, which is the point of having them.

**Rotation.** Two ways, and they behave differently:

- *Random subset per page load* — simple, but the list changes while you are
  looking at it and an award can vanish on refresh.
- *Seeded by the puzzle date* — the same selection all day for everyone,
  rotating automatically as days pass. A line or two more work, and it means
  players can talk about the same list. **This is the one to pick.**

## The trap

Several of these need history before they mean anything. "Personal best" needs a
previous best; "off day" needs an average; "metronome" over three finds is noise.

Suggest suppressing any award whose holder has fewer than about five completed
games, rather than crowning someone on two data points. The same reasoning
already governs `MIN_SETS_FOR_SCAN_ORDER`, and the same trap is described at
more length in [`board-diversity.md`](board-diversity.md) and
[`set-dimensionality.md`](set-dimensionality.md): a statistic that fires on thin
data does not become reliable by being displayed confidently.
