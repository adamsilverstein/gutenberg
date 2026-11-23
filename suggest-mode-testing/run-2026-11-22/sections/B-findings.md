# Section B findings (IA-01 to IA-09)

No 🟡 or 🔴 flows in this section: all nine are 🟢.

## Observations (no flow downgraded)

- IA-06: from the end of your own addition, two ArrowLeft presses move the caret one character, because the first press is spent on the marker edge. Typing still extends the same marker and note.
- IA-08: a split is still two notes (`Delete:` and `Insert block:`) that can be decided separately - the remaining gap already recorded under F-07, not re-tested here.

## Fixed since August

- F-05 (stray "Format: content" note on a typed addition): not seen - IA-01, and no other typed suggestion in sections A to C produced one. It was never reproducible, so this is "not observed" rather than proven fixed.
- F-06 (typing inside your own addition splits it): fixed - IA-06. One marker `ADDEXXD`, one note, by arrow keys and by mouse click.
- F-07 (suggested split shown as a completed split): fixed - IA-08. The head paragraph keeps its text with a rendered `del` marker over the tail.
- F-10, whitespace half (`Add: " "` for any number of spaces): fixed - IA-09. The note reads `Add: 3 spaces`.
