Section P is new in this run (overlapping suggestions, PR #85794); August had no flows for it, so every finding below is new. Text selections were placed through the block editor store, as the product's own overlap specs do, because arrow keys cannot count offsets across markers; every edit itself was a real key press or click.

### The owner of an addition can erase suggestions other people nested in it, silently
- **Flows:** OV-16, OV-08
- **Severity:** 🔴
- **Relation to August:** new
- **Repro:**
  1. As editor-user, Suggesting, type `EDITOR SENTENCE HERE ` in a paragraph. Save.
  2. As admin, Suggesting, type `SECOND ` before `HERE` inside that addition, then select `HERE` and press Backspace. Save.
  3. As editor-user, Suggesting, select `SECOND HERE` and press Backspace.
- **Observed:** The text is removed outright: admin's nested addition and admin's deletion marker are gone, no deletion marker is written, no note request is sent, no snackbar, nothing in the live region. Block content afterwards: `<mark add #597>EDITOR <mark add #598>ADMIN </mark>SENTENCE  </mark>`. admin's notes stay `hold` and describe text that no longer exists. Same result for author-user deleting admin's `COPY` on the author's post, where admin's card silently turned from `Replace: "TEXT" → "COPY"` into `Delete: "TEXT"`.
- **Expected:** Per the overlap table in `docs/explanations/architecture/suggestions.md`, deleting inside someone's addition is a nested deletion. Text another author added should get a deletion suggestion (or at least a warning) rather than vanish, even when it sits inside the deleting user's own addition.
- **Likely area:** guess - the deletion keyboard treats everything under the user's own outermost `add` marker as their own text (`suggestion-deletion-keyboard.ts`, `strip-markers.ts` "Text nested in another author's addition goes with it").

### Enter is refused more widely than documented, with a message that does not fit
- **Flows:** OV-13
- **Severity:** 🟡
- **Relation to August:** new
- **Repro:**
  1. Suggesting, type an addition in a paragraph, then press Enter with the caret inside it.
  2. In a paragraph holding another user's suggestion, press Enter with the caret in plain text away from any marker.
- **Observed:** Both are refused with "This change overlaps a pending suggestion, so it was not captured. Accept or reject that suggestion first." (snackbar and live region, so the refusal is announced). In a paragraph with only the user's own suggestions, Enter in plain text is allowed.
- **Expected:** The docs say only splitting a block inside someone else's suggestion is declined. Either allow Enter inside one's own addition and in plain text, or say what is actually blocked: the user's own addition is not something they should have to "accept or reject first".
- **Likely area:** `suggestion-mode/refuse-edit.ts` and its callers.

### Rejecting an outer addition leaves a record for other people's nested suggestions but not for your own
- **Flows:** OV-11
- **Severity:** 🟡
- **Relation to August:** new
- **Repro:**
  1. editor-user suggests an addition; admin nests an addition and a bold inside it.
  2. As admin, reject the editor's addition and save.
- **Observed:** The card says "Rejecting also makes 2 suggestions outdated.", but admin's two nested notes go to the trash (`status: trash`, `_wp_suggestion_status` still `pending`) and vanish from the sidebar. When the editor withdraws the addition instead, the same two notes become `approved` / `outdated` and stay listed with "No longer applies - the text was removed." and Reopen.
- **Expected:** The same outcome whoever clicks, matching the card's wording.
- **Likely area:** guess - the own-note garbage collector (`suggestion-note-gc.ts`) runs for the reviewer's own notes before they can be marked outdated.

### Clicking a nested addition selects the outer card, and stacked markers say nothing in the canvas
- **Flows:** OV-09
- **Severity:** 🟡
- **Relation to August:** new
- **Repro:**
  1. Open a post where one user's addition holds another user's addition, deletion and format.
  2. Click each nested run and watch which card gets selected.
- **Observed:** Nested deletion and nested format select their own cards; the nested addition selects the outer addition's card. Markers have no `title` or ARIA attributes.
- **Expected:** A click selects the innermost suggestion under the pointer, or offers the stack.

### Block-level overlap cards: missing name, missing warning
- **Flows:** OV-14, OV-15
- **Severity:** 🟡
- **Relation to August:** new
- **Repro:**
  1. editor-user suggests inserting a block; admin suggests removing it, rejects that removal, then removes it again.
  2. Separately: admin adds an inline suggestion in a paragraph; editor-user suggests removing the block and accepts the removal.
- **Observed:** (1) After the second removal the insertion's card says "Someone else also suggested removing this block" where it first said "admin also suggested...". (2) The removal card never mentions the other author's inline suggestion inside the block; accepting it marks that suggestion outdated without warning.
- **Expected:** The name stays; a removal over other people's suggestions carries the same "Includes N suggestions from others" line that inline additions do.

## Fixed since August
- Not applicable: Section P has no August baseline. For reference, the gestures August recorded as refused or as hiding every marker (MU-07, F-09) now nest or stack: OV-06 and OV-07.
