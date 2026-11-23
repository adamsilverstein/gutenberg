# Section C findings (ID-01 to ID-12)

### A cross-block delete reads differently for Delete and Backspace, and the Delete form is misleading
- **Flows:** ID-08
- **Severity:** 🟡
- **Relation to August:** F-10 fixed (summaries are readable now); the "no inline markers" half of the August result is still present; the Delete/Backspace asymmetry is new to this write-up
- **Repro:** 1. In Suggesting, put the caret after "del" in "Third paragraph: plain text used for deletions and replacements." 2. Shift+ArrowRight until the selection ends after "Fourth paragraph" in the next block. 3. Press Delete. 4. Repeat on a fresh post with Backspace.
- **Observed:** Both are captured without merging (7 blocks, attributes untouched) as two structural notes with no inline markers. Backspace: paragraph 3 gets `Replace: “deletions and replacements.” → “del closes the opening section of the post.”`, paragraph 4 gets `Remove block`. Delete: paragraph 3 gets `Remove block: paragraph “Third paragraph: plain text used for deletions and replacements.”` (whole block struck through) and paragraph 4 gets `Replace: “Fourth paragraph” → “Third paragraph: plain text used for del”`. The end document is the same, but the Delete form tells the reviewer the paragraph that mostly survives is being removed. In both, the surviving block shows only the merged result, with no strike-through of the text being dropped.
- **Expected:** One description of the edit whichever key was used, keeping the first block and removing the second (what Editing mode does for both keys), ideally with the removed ranges struck through in place.
- **Likely area:** the merge capture in the Suggestion mode block interceptor (a guess: forward delete merges into the following block, so the overlay lands on that block).

### Backspace at block start is described as replacing the last word
- **Flows:** ID-10
- **Severity:** 🟡
- **Relation to August:** unchanged from the August ID-10 result (label changed from Add/Delete to Replace); F-10 itself is fixed
- **Repro:** 1. In Suggesting, put the caret at the very start of the first paragraph (after the heading). 2. Press Backspace.
- **Observed:** No merge happens (7 blocks). The heading gets a `pending-attributes` overlay and renders "Field notes from the riverThe quick brown fox jumps over the lazy dog near the riverbank."; the paragraph is `pending-remove` and struck through. Notes: `Replace: “river” → “riverThe quick brown fox jumps over the lazy dog near the r…”` and `Remove block: paragraph “The quick brown fox ...”`. No inline marker. Paragraph after paragraph gives the same shape: `Replace: “it.” → “it.Third paragraph: ...”`.
- **Expected:** A summary that says text was appended (for example `Add: “The quick brown fox ...”`, or a single "Merge with previous block" note), since nothing in the first block is replaced.
- **Likely area:** the word-level diff that builds the `attribute-set` summary - the last word and the first appended word have no space between them, so they diff as one changed token (a guess).

## Observations (no flow downgraded)

- ID-12: after an addition is fully withdrawn and its note trashed, the block still carries `metadata.noteId: [<trashed id>]` in the editor. Not checked whether a save clears it.
- ID-08: pressing Backspace or Delete with no pause after 41 scripted Shift+ArrowRight presses merges with a stale selection end, in Editing mode as well as Suggesting. With a 500ms pause both modes are correct. Script speed, not a Suggestion mode defect.

## Fixed since August

- F-08 (repeated forward Delete drops markers and mutates rendered text): fixed - ID-03. One marker grows "j" to "jumps", rendered text intact after every press, one note.
- F-09 (whole-content fallback hides existing markers): fixed for the inline cases - ID-11 (add trimmed to "PEND" plus a `del` on "jumps", both rendered) and ID-12 (addition shrinks to "PENG", then withdraws and its note is trashed).
- F-10 (summaries strip spaces and leak HTML): fixed - ID-08 and ID-10. Summaries have their spaces and no tags, including the paragraph with `<strong>` and `<a>` in ID-10's second variant.
