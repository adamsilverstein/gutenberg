### Undo past a withdrawn block insertion resurrects it as a new suggestion
- **Flows:** UN-06 (visible after UN-05's insert case too)
- **Severity:** 🟡
- **Relation to August:** new (F-33 ordering itself is fixed)
- **Repro:**
  1. Suggesting mode. Type "ADDED " into paragraph 1.
  2. Put the caret at the end of paragraph 4, press Enter, type "Inserted block".
  3. Press undo repeatedly, reading the notes after each press.
- **Observed:** Undo 1 withdraws the insertion (block and note gone). Undo 2 brings the paragraph back containing only "I", marked `pending-insert`, with a brand-new note (`Insert block: paragraph “I”`, new comment id). Undo 3 leaves an empty paragraph with no suggestion metadata. Undo 4 removes it. Undo 5 withdraws the addition. Two suggestions cost five undos and three notes end up in trash; in the five-suggestion run it was eight undos. The end state is pristine.
- **Expected:** One undo per suggestion; after a structural suggestion is withdrawn as a unit, its underlying typing history should not replay.
- **Likely area:** guess - the unit withdrawal of a pending insert does not consume the block-editor history entries for Enter and the typed characters, so later undos walk through them and the capture layer re-captures the reappearing block.

## Fixed since August
- F-18 (undo after accept restores the marker without its note): fixed, UN-08.
- F-33 (undo order does not match action order): fixed, UN-06 (order is newest-first; see the new finding above for the extra presses).
