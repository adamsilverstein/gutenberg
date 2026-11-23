### Text typed in Suggesting is discarded when the note request fails (offline)
- **Flows:** EX-08
- **Severity:** 🔴
- **Relation to August:** new (August only tested saving the post offline)
- **Repro:**
  1. Open a post, switch to Suggesting, make one suggestion so the feature is warm.
  2. Go offline (DevTools network offline).
  3. Click at the end of another paragraph and type ` OFFLINEADD`.
  4. Go back online and wait.
- **Observed:** 11 failed `POST /wp/v2/comments` requests, one per keystroke; a stack of identical "Unable to connect. Please check your Internet connection." snackbars; the block content never contains the typed text (store sampled at 0, 1, 2, 3 and 6 seconds; canvas screenshot at 6 seconds), and nothing comes back after reconnecting (the next keystroke online starts a fresh suggestion with only that character). The post-save part of the flow is fine: offline save is reported, the post stays dirty, the retry succeeds, no duplicate notes.
- **Expected:** Typed text is kept (as it is in Editing) and the note is created on retry, or Suggesting visibly refuses input while it cannot save; one notice, not one per keystroke. Any failing note request (expired session, server error) presumably takes the same path - not tested.
- **Likely area:** guess - the capture path that only commits the marker after the note is created; `packages/editor/src/components/suggestion-mode`.

### Suggested text is lost when the mode is toggled at machine speed
- **Flows:** EX-09
- **Severity:** 🟡
- **Relation to August:** regression (August 🟢 for three rapid cycles; speed then not recorded)
- **Repro:**
  1. In Editing, put the caret at the end of a paragraph.
  2. Repeat three times with 10ms between keys and no pauses: Suggesting shortcut, type ` S0s`, Editing shortcut, type ` E0e`.
- **Observed:** Paragraph ends ` E0e E1e E2e`; all `S` strings are gone, and three notes were created then trashed (3 of 3 identical runs; a fourth, in a post that already had a suggestion, reordered the text and lost one string). At 40ms per key the result is correct every time, and a single switch right after typing is also correct, so a person typing is unlikely to hit it; scripted input and very fast shortcut use can.
- **Expected:** Each keystroke lands on its side of the switch regardless of speed; a suggestion still waiting for its note is not dropped by a mode change.
- **Likely area:** guess - same deferred commit as the offline finding: the suggestion is not in the block until its note request returns, and a mode switch in that window discards it.

### Leaving Suggesting through "Edit original" is silent, and in-app navigation keeps the mode
- **Flows:** EX-03, EX-07
- **Severity:** 🟡
- **Relation to August:** new (both flows were not run in August)
- **Repro:**
  1. Post with a synced pattern; switch to Suggesting and make a suggestion in a normal paragraph.
  2. Select the pattern and click "Edit original".
  3. Type in the pattern, then click Back and type in the post.
- **Observed:** Inside the post the pattern content is locked (no suggestion, no edit). In the pattern editor there is no Editing/Suggesting choice and no notes button; typing changes the pattern directly while the "You're suggesting" snackbar is still showing. Back in the post the mode is still Suggesting and pending suggestions are intact. A command-palette switch to another post is a full reload and arrives in Editing.
- **Expected:** A clear signal that the pattern is edited directly (or that suggesting is unavailable there), and a decision on whether mode should survive in-app navigation, given the plan expected a reset.
- **Likely area:** `packages/editor/src/components/suggestion-mode/block-ownership.ts` holds the "saved outside this post" guard for the host post; the pattern editor has no equivalent notice.

### Template context: stray "saved outside this post" snackbar, and in-post template editing unverified
- **Flows:** EX-04
- **Severity:** 🟡
- **Relation to August:** new
- **Repro:**
  1. Post with one pending suggestion, saved; stay in Suggesting.
  2. Open Settings > Post and expand the "Template: Single Posts" panel.
- **Observed:** Snackbar "This block is saved outside this post, so it can't be changed while suggesting." appeared although nothing was edited (one occurrence, captured in the screenshot; not re-confirmed). The script could not get from there into template editing, so only the Site Editor side (no suggestion UI, shortcut inert, no errors) is certified.
- **Expected:** No notice without an edit attempt. Needs a manual pass for "Edit template" from the post editor while suggestions are pending.
- **Likely area:** guess - the template preview rendered in that panel trips the ownership guard in `block-ownership.ts`.

### Console: 403 from the notes request on a post type without notes
- **Flows:** EX-10 (seen in EX-03)
- **Severity:** 🟡
- **Relation to August:** new (August recorded zero console errors)
- **Repro:**
  1. In a post, select a synced pattern and click "Edit original".
- **Observed:** `GET /wp/v2/comments?post=<pattern id>&type=note&status=all…` returns 403 `rest_comment_not_supported_post_type` and is logged as a console error (2 of 2 runs). Every other flow in sections K and O was clean apart from expected offline errors and TinyMCE's own messages.
- **Expected:** The notes request is not sent for post types that do not support notes.
- **Likely area:** notes loading in `packages/editor/src/components/collab-sidebar/hooks.js` (guess); may predate Suggestion mode.

## Fixed since August
- F-04 exposure through the code editor: the code editor cannot be opened while suggestions are pending or while Suggesting, with an explanation each time - EX-06.
- No other August finding is cited by section O. EX-03 and EX-05, not run in August, now have results (EX-05 clean: Classic block edits are captured as one block-level suggestion).
