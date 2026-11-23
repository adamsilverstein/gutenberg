# Section J findings (PS-01 to PS-12)

None of PS-01 to PS-12 needs the experiment off, so no flow in this section was retired for that reason.

### Restoring a revision that contains suggestions brings back unreviewable markers and loses the proposed text
- **Flows:** PS-10
- **Severity:** 🔴
- **Relation to August:** new (August flagged revision restore as the untested risky half; this is that half)
- **Repro:**
  1. On a draft, make a plain edit and Save draft.
  2. In Suggesting, add text to one paragraph, delete a word in another, press Enter after a paragraph and type a new one, and move the list up. Save draft.
  3. Switch to Editing, make another plain edit, Save draft.
  4. Post sidebar → Revisions. Step back to the revision from step 1 and Restore.
  5. Open Revisions again, step to the revision from step 2 and Restore.
- **Observed:** Step 4 is clean: content restored, no markers, and the four suggestion notes (417, 418, 419, 422) are moved to trash. Step 5 returns a half state: `del#418 "replacements."` and the pending move (with its ghost) are back in the canvas, the block that had the addition carries `noteId: [417]` but the added text ` ADDEDTEXT` is gone, the `INSERTED BLOCK` paragraph is gone, all four notes are still in trash, there is no All notes button, and the two visible suggestions have no card and cannot be accepted or rejected. Identical after a reload. No console errors.
- **Expected:** Restoring a revision that holds suggestions should give back reviewable suggestions (untrash or recreate their notes and re-inflate the extracted additions and inserted blocks), or strip the leftover markers and pending metadata so nothing unreviewable remains. Proposed content should not be lost silently.
- **Likely area:** the interaction of three pieces - proposals are extracted out of `post_content` onto the note at save (PS-11), the note collector trashes notes whose markers disappear, and revision restore writes old content without touching notes. A guess as to the exact code path.

### After an unsaved suggestion on a published post, its note claims the block was deleted
- **Flows:** PS-09
- **Severity:** 🟡
- **Relation to August:** new (August could not reach the autosave banner state)
- **Repro:**
  1. Open a published post, switch to Suggesting, type ` AUTOSAVED` at the end of the first paragraph.
  2. Let an autosave run (or trigger one), then reload and accept the leave-page dialog without saving.
  3. Open All notes.
- **Observed:** The standard "There is an autosave of this post that is more recent than the version below." banner shows. The canvas has no marker (the suggestion lives only in the autosave), but note 291 is listed as "Original block deleted." / `Change: text` / "Target block has been deleted." with Accept and Reject buttons. The paragraph is still there. Following View the autosave → Restore brings the marker and `Add: “ AUTOSAVED”` back. No duplicate notes at any point (1 before, 1 after).
- **Expected:** A note whose marker is missing only because the content was not saved should say that (or point at the autosave), not report a deleted block, and should not offer Accept/Reject on nothing.
- **Likely area:** the note's "outdated" state in the collab sidebar treats "marker not found in content" as "block deleted" (a guess; see `suggestion-mode-outdated.spec.ts` for the intended cases).

## Observations (no flow downgraded)
- PS-06: the front end now renders the ORIGINAL formatting for a pending format suggestion (no `<strong>`); in August the pending bold was visible to readers.
- PS-11: stored `post_content` now holds content-free anchors (empty add mark, `wp:suggestion-placeholder` blocks, baseline order and attributes); the proposals live on the note and are re-inflated for edit-context reads.
- PS-12: copy/paste carries pending additions, pending formatting, pending inserted blocks and the proposed block order as ordinary content, while a pending deletion keeps its text and a pending attribute change is not applied. No markers or note ids leak. Worth a product decision on whether "what you see" is the wanted rule.

## Fixed since August
- **F-19** (pending move applied to the published front end) - PS-07: the list renders in its original position.
- **F-34** (copying content out carries markers and dangling note ids) - PS-12: 0 marks, 0 `noteId`, 0 `suggestion` metadata in the pasted post.
