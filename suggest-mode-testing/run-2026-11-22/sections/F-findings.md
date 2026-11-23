# Section F findings - Structural suggestions

### An empty block inserted while Suggesting is saved into the post untracked
- **Flows:** ST-02
- **Severity:** 🟡
- **Relation to August:** new (August reloaded without saving, so the save path was not exercised)
- **Repro:**
  1. Open a draft, switch to Suggesting.
  2. Click at the end of the first paragraph and press Enter. Do not type.
  3. Click into another paragraph. No note exists and the "All notes" toggle is absent.
  4. Press "Save draft" (it is enabled, the post is dirty).
  5. Reload.
- **Observed:** The save request (`POST /wp/v2/posts/<id>` 200) stores the empty paragraph: the stored content has 5 paragraph blocks and one `<p></p>` where the seed had 4. After the reload the empty paragraph is still in the post as a plain block with no `metadata.suggestion` and no note, so nobody can accept or reject it.
- **Expected:** An empty block that never became a suggestion should not reach the stored content from a Suggesting session; it should be dropped on save (or on leaving it), or be tracked as a pending insert.
- **Likely area:** `packages/editor/src/components/suggestion-mode/store-interceptor.ts`, where new empty blocks are deliberately left without a `block-insert-after` operation until they have content (a guess from the behaviour, not traced).

### A cross-block text deletion is captured as three unlinked notes
- **Flows:** ST-07
- **Severity:** 🟡 (open question, no data loss seen)
- **Relation to August:** new (August selected whole blocks; the whole-block case still passes)
- **Repro:**
  1. Suggesting mode. Click inside the first paragraph, then Shift-click inside the third paragraph. Gutenberg makes this a partial selection (`getMultiSelectedBlockClientIds().length` is 3, selection offsets 37 and 39).
  2. Press Backspace.
- **Observed:** Three notes with no `groupId`: "Replace: “lazy dog near the riverbank.” → “laletions and replacements.”" on the first paragraph (a whole-content `pending-attributes` overlay, no inline markers), and "Remove block: paragraph …" on the second and third. The third paragraph is shown fully struck through although its tail is proposed to live on in the first. A reviewer who accepts the two removals and rejects the Replace loses that tail. Starting from the heading with Shift+ArrowDown twice gives the same shape: "Replace: “Field notes from the river” → “A second paragraph with bold words and a link in it.”" on the heading plus two paragraph removals.
- **Expected:** Either one grouped suggestion (the block transform in ST-17 now shares a `groupId` across its two notes), or inline delete markers on the first and last block, so the pieces cannot be decided into an inconsistent result.
- **Likely area:** the merge path of the store interceptor (`store-interceptor.ts`), which already assigns `groupId` for transforms (a guess).

## Observations that did not change a verdict

- ST-06: the Escape route to block selection cannot be driven by Playwright in this build. After Escape the selection keeps its text offset and Backspace is a no-op in Editing and Suggesting alike. Block selection by clicking an Image block and by List View both capture `pending-remove` correctly. Worth one manual check of Escape then Backspace.
- ST-09: the "Suggested move" badge is still partly covered by the block toolbar while the moved block is selected (same nit as August).
- ST-11: a click on the move ghost falls through to the canvas and puts the caret at the end of the block below it, so typing there becomes a normal "Add" suggestion. The ghost itself is untouched.
- ST-12: the ghost at the origin and the Move summary quote the block text including a later, still pending, inline addition ("EDITED The quick brown fox …").
- ST-14: "in group" is appended to Insert and Remove summaries but not to the Move summary of a nested block.
- ST-15: the move ghost inside a list is a `div` child of the `ul`.
- ST-03: inserting an Image block creates its note while the block is still an empty placeholder, unlike a paragraph, which waits for content (ST-02).

## Fixed since August

- F-13 (question: should the move ghost be hidden from screen readers?): settled in the build. The ghost is `role="note"` with a visually hidden "Original position of moved Paragraph block." and an `aria-hidden` visible label. Shown by ST-11.
- ST-17's unlinked transform halves (no F number, noted in the August row): the remove and insert notes now share a `groupId` and rejecting one rejects both. Shown by ST-17.
- August "no verdict" rows now have real evidence: ST-06 (block selection plus Backspace), ST-10 (drag handle), and the parts of ST-03 (upload), ST-14 (List View, nesting context) and ST-15 (reorder) that were not covered.
