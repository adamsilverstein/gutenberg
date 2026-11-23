# Section H findings (NS-01 to NS-09)

### Deleting a suggestion's note is a hidden, delayed reject that strands the marker
- **Flows:** NS-06
- **Severity:** 🟡
- **Relation to August:** new (August only checked for a Resolve button; the Actions menu was not exercised)
- **Repro:**
  1. In Suggesting, type ` DELNOTE` at the end of a paragraph and wait for the note to save. Save draft.
  2. Open All notes, select the suggestion card, open its Actions menu and choose Delete, then confirm.
  3. Look at the canvas, then Save draft and reload.
- **Observed:** The card menu offers `Edit` and `Delete`. After Delete (snackbar "Note deleted.", Undo offered) the note is in trash, All notes is empty, and marker `add#432 " DELNOTE"` is still in the canvas with no card and no Accept/Reject. When the delete is done in Suggesting intent the block also gains `metadata.suggestion: {"type":"pending-attributes","authorId":1,"after":{}}` with no `commentId` and the class `is-suggestion-pending` (not when done in Editing intent). After save + reload the marker and the proposed text are gone (block back to the original sentence), the All notes button is gone, and the block carries `metadata.noteId: [432]` pointing at the trashed note. Same outcome in Editing intent (note 435).
- **Expected:** Either a suggestion note cannot be deleted from the generic Actions menu (Accept and Reject being the only ways to close it), or Delete does exactly what Reject does at once: remove the marker, leave no stray `metadata.suggestion`, and leave no `noteId` behind.
- **Likely area:** `packages/editor/src/components/collab-sidebar/hooks.js` `onDelete` - it removes the note id and any inline *note* marker (`removeInlineNote`) but knows nothing about suggestion markers. The stray `pending-attributes` looks like the metadata update being captured by the Suggesting-intent attribute interceptor (a guess).

### An accepted suggestion's summary collapses to "Change: text"
- **Flows:** NS-05
- **Severity:** 🟡
- **Relation to August:** new (related in spirit to F-27, summaries lacking context)
- **Repro:**
  1. In Suggesting, type ` REPLYME` at the end of a paragraph.
  2. In All notes, reply "Why this change?" on the suggestion.
  3. Accept the suggestion. Read the card. Save and reload; read it again under Resolved.
- **Observed:** Before the decision the card reads `Add: “ REPLYME”`. Immediately after Accept, and after save + reload, it reads `Change: text` with the "Applied" badge. The reply survives (note 112, parent 111) but the thread no longer says what was accepted.
- **Expected:** A decided suggestion keeps the summary it had while pending (`Add: “ REPLYME”`), so the history and its replies stay readable.
- **Likely area:** the summary appears to be derived from the live marker in the block content and falls back to a generic label once the marker is gone; the note's `_wp_suggestion` meta still has the operation and could feed the summary (a guess).

## Fixed since August
- **F-16** ("Format:" vs "Formatting:") - NS-01: the two families now read `Add formatting:` and `Change:`.
- **F-17** (suggestion pops the notes sidebar open) - NS-03: active complementary area stays `null`; NS-02 shows an open settings sidebar is not replaced either.
- **F-31** (clicking a note does not reveal its marker) - NS-04: note click scrolls the marker into view and gives it the 3px active treatment; marker click selects its thread.
- **F-32** (notes display-mode preference read by nothing) - NS-08: Expand / Minimize / Hide all change the floating cards.
- NS-07 (not an F-number): a plain note and a suggestion on one block could be created and verified through the UI; August had no verdict.
