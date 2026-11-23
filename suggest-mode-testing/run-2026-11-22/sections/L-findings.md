### A stale session's save silently discards the other user's suggestion
- **Flows:** MU-08
- **Severity:** 🔴
- **Relation to August:** F-21 no longer reproduces (no duplicated document, no `pending-insert` flood, no manufactured notes); this is a different failure in the same flow. August's server kept both edits, this run's does not. August's site was sending `wp-sync` traffic and this site has no real-time collaboration, so the environments differ.
- **Repro:**
  1. As admin, open a draft and switch to Suggesting. Leave the tab open.
  2. As editor-user in another browser, open the same post, click Take over, type a suggestion, save.
  3. Within about 15 seconds, back in admin's tab (which shows no warning yet), type a suggestion in another paragraph and save.
- **Observed:** Both saves return 200. Server content has admin's `ASAYS ` marker only; `BSAYS` occurs 0 times. editor-user's note is `approved` with `_wp_suggestion_status: outdated`. admin's tab shows "Someone else has taken over this post" only after its save went through. Reproduced twice (posts 118 and 136).
- **Expected:** A session that lost the post lock should not be able to overwrite content that holds another user's pending suggestion, or the server should keep markers whose notes are still pending.
- **Likely area:** guess - core post locking is advisory for REST saves; Suggestion mode adds nothing on top (no lock check before the suggestion write or the post save).

### Additions and deletions are no longer tinted per author
- **Flows:** MU-03 (MU-04)
- **Severity:** 🟡
- **Relation to August:** new (deliberate design change; `docs/explanations/architecture/suggestions.md` says additions and deletions are green and red "whoever suggested them")
- **Repro:**
  1. As editor-user, suggest an addition. As admin, suggest an addition in another paragraph.
  2. Compare the two markers; then have each user bold a word.
- **Observed:** Both additions compute to the same green underline and tint. Only `format` markers differ (amber for editor-user, red for admin). A suggested block sets `--suggestion-author-color` but draws the same green outline. admin's red format tint (`rgb(217 65 69 / .25)`) is close to the deletion tint (`rgb(204 24 24 / .25)`).
- **Expected:** The August plan expected every marker tinted per author. If type colours are the decision, an author cue in the canvas (hover, or the avatar colour on the rule) and an avatar palette that avoids the add and delete hues would help.
- **Likely area:** `content-suggestion.scss`, `SuggestionAuthorColors`.

### "Save the post to keep this decision" stays on the card after the save, and the reviewer is never named
- **Flows:** MU-09 (also seen in OV-08, OV-15)
- **Severity:** 🟡
- **Relation to August:** new (provisional decisions did not exist in August)
- **Repro:**
  1. On a draft with a pending suggestion, click Accept in the notes sidebar.
  2. Save the draft and wait.
- **Observed:** The note becomes `approved` / `applied` on the server, but the card still reads "Applied - Save the post to keep this decision." 3 seconds after "Draft saved." Seen as admin, editor-user and author-user. On a published post (OV-11) the hint cleared after "Post updated."; a reload always clears it. The card never says who decided, although `_wp_suggestion_decided_by` and `_wp_suggestion_resolved_by` hold the reviewer's id.
- **Expected:** The hint goes away once the save succeeds; ideally the card says "Applied by admin".
- **Likely area:** guess - the sidebar's note records are not refetched after a draft save.

### A suggester can still accept their own suggestion
- **Flows:** MU-10
- **Severity:** 🟡
- **Relation to August:** F-20 still present (product question, not a defect)
- **Repro:**
  1. As editor-user, suggest an edit on admin's post and open All notes.
- **Observed:** Accept and Reject both show on the editor's own card and on admin's cards. Reject works as a withdraw; Accept is allowed too. `_wp_suggestion_decided_by` now records who did it.
- **Expected:** Open by design; the flow asks for the behaviour to be documented.

## Fixed since August
- F-09 (markers vanish when another author's range is overlapped): fixed - MU-07 shows every marker still rendered and the deletion nested inside the other author's addition.
- F-21 (second session's content read as a page of insertions): the August symptoms do not reproduce in MU-08 (7 blocks, no `pending-insert`, 2 notes). Note that no reconcile happens on this site, so the fix path itself was not exercised.
- MU-06's uneven `metadata.noteId` and duplicated marker: fixed - noteId is `[88, 92, 93]` for three suggestions in one paragraph.
- MU-09's missing reviewer record: fixed - `_wp_suggestion_decided_by` / `_wp_suggestion_resolved_by` hold the reviewer's user id.
