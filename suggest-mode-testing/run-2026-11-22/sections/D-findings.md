### Dragging text within a block leaves a stray deletion suggestion and drops the text
- **Flows:** IR-09
- **Severity:** 🔴
- **Relation to August:** new (August could not automate the drag; F-37 coverage gap now closed)
- **Repro:**
  1. Open a post, switch to Suggesting.
  2. Select "brown " in "The quick brown fox jumps over the lazy dog near the riverbank."
  3. Press on the selection, hold briefly, drag it to just before "lazy", release.
- **Observed:** A `del:"brown "` marker and a `Delete: “brown ”` note appear at the origin; nothing is added at the destination; a snackbar says "The edit could not be captured as a suggestion." `dragstart` and `drop` both fired. The same gesture in Editing mode moves the text. Accepting the leftover suggestion deletes a word the author meant to move.
- **Expected:** Either del (origin) + add (destination), or a full refusal that leaves no suggestion behind.
- **Likely area:** guess - the drop reaches the content reconciler as a delete followed by an insert and only the first half is accepted; see `packages/block-editor/src/components/rich-text/event-listeners/paste-handler.ts` (`onDrop`) and the suggestion reconciler in `packages/editor/src/components/inline-suggestions`.

### A multi-line paste puts an overlay on a block that has inline markers, and accepting it resurrects a rejected suggestion
- **Flows:** IR-10 (also touches IR-04)
- **Severity:** 🔴
- **Relation to August:** F-09 partly fixed (delete-inside-own-add no longer triggers it and markers keep rendering; the marker + overlay coexistence survives via multi-line paste)
- **Repro:**
  1. Suggesting mode. In paragraph 2 paste "PASTEDLINE " before "second" (inline add, note A).
  2. In the same paragraph, place the caret before "bold" and paste two lines of plain text ("LINE ONE\nLINE TWO").
  3. Inspect the block: `metadata.noteId: [A, B]`, content holds the `<mark>` for A, and `metadata.suggestion` is `pending-attributes` for B with an `after` string that also embeds the `<mark>` for A.
  4. Switch to Editing. Reject A. Then accept B and choose "Apply anyway" in the confirm dialog.
- **Observed:** After step 4a the content has no mark and A reads "Rejected", but the canvas still shows the PASTEDLINE marker (it is rendered from B's snapshot). After step 4b the block content is `A <mark data-suggestion-id="A" ...>PASTEDLINE</mark>second paragraph with LINE ONE<br>LINE TWO` and A's card is back to `Add: “PASTEDLINE”`: the rejected suggestion has returned. No `ins`/`del` overlay elements render, so the DOM-level invariant holds; the data-level one does not.
- **Expected:** A block with pending inline markers either expresses the multi-line paste as markers or declines it; an overlay snapshot should never carry another suggestion's marker.
- **Likely area:** guess - the paragraph-split path of multi-line paste (the `pending-attributes` + `pending-insert` pair) bypasses the "decline rather than overlay a marked block" rule covered in `suggestion-mode-overlay-retirement.spec.ts`.

### Multi-line paste is still two unlinked whole-block notes
- **Flows:** IR-04
- **Severity:** 🟡
- **Relation to August:** F-10 fixed (spaces kept); F-28 still present
- **Repro:** Suggesting mode, caret before "jumps", paste three lines of plain text.
- **Observed:** Block 1 gets a `pending-attributes` overlay (`Replace: “jumps over the lazy dog near the riverbank.” → “LINE ONE LINE TWO LINE THREE”`), the tail becomes a `pending-insert` paragraph (`Insert block: paragraph “jumps over...”`). No inline marker; the tail is described as both replaced and inserted; accepting one note and rejecting the other duplicates or loses the tail.
- **Expected:** One reviewable unit, or linked notes.

### A typed or pasted replacement renders the new text before the struck text
- **Flows:** IR-01, IR-03
- **Severity:** 🟡
- **Relation to August:** new
- **Repro:** Suggesting mode, select "jumps", type "leaps" (or paste "REPLACED").
- **Observed:** Content is `fox <mark add>leaps</mark><mark del>jumps</mark> over`, displayed "leapsjumps". August rendered "jumpsleaps", and the reconciler paths (IR-06, IR-07, IR-08) still put the deletion first. Those paths also write two notes (Delete + Add) where this one writes a single Replace note.
- **Expected:** One consistent order (deletion then addition is the convention) and one consistent note shape for a replacement.

### Input seams verified only by approximation
- **Flows:** IR-06, IR-07, IR-08
- **Severity:** 🟡
- **Relation to August:** F-37 still present (coverage gap); IR-08 word-level diff fixed
- **Repro:** see the spec `test/e2e/suggest-run/agents/dei/D.spec.ts`.
- **Observed:** Synthetic `insertReplacementText` and CDP IME both reconcile into clean whole-word del + add markers with no duplicated text.
- **Expected:** A human pass with real autocorrect, a real IME and a real spellcheck menu.

## Fixed since August
- F-29 (pasted rich text loses formatting and links): fixed, IR-05.
- F-10 (summaries strip spaces): fixed, IR-04.
- F-09 (whole-content fallback hides markers): the August trigger is fixed, IR-10 (delete inside own addition shrinks the marker); a different trigger remains, see above.
- F-27 part (character-fragment diffs such as "eh" → "he"): fixed, IR-08.
