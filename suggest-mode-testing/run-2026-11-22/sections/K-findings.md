### Decided suggestion cards lose or misstate what was decided
- **Flows:** RV-01, RV-11, RV-18 (also visible in RV-02, RV-08, RV-09, RV-17, RV-19, RV-21)
- **Severity:** 🟡
- **Relation to August:** new
- **Repro:**
  1. In Suggesting, type ` KEEPME` mid-paragraph; the card reads `Add: " KEEPME"`.
  2. Switch to Editing and Accept (or Reject) it.
  3. Separately: in Suggesting press Enter at the end of a paragraph, type `NEW BLOCK`, then Reject it.
- **Observed:** After the decision an inline add, delete or replace card reads only `Change: text` (before and after saving), so in RV-18 three of eight decided cards are identical. A rejected block insertion reads `Insert block: paragraph "N"`: the note meta stores `"excerpt":"N"`, the first keystroke, and the live block that supplied "NEW BLOCK" is gone. Format, attribute, move and remove cards keep their full label.
- **Expected:** A decided card still says what was accepted or rejected (`Add: " KEEPME"`, `Insert block: paragraph "NEW BLOCK"`), since the note is now kept as the record of the decision.
- **Likely area:** guess - the inline note meta stores only `suggestionType` and reads its text from the live marker (`packages/editor/src/components/collab-sidebar`), and the insert excerpt is captured once when the note is created and never refreshed.

### Rejecting a suggestion no longer leaves the post byte-identical
- **Flows:** RV-08 (same in RV-09, RV-10, RV-12, RV-13, RV-14, RV-15)
- **Severity:** 🟡
- **Relation to August:** new (August measured byte-identical markup)
- **Repro:**
  1. Seed a post and record `content.raw`.
  2. In Suggesting, type an addition in a paragraph.
  3. In Editing, Reject it, save, and compare `content.raw`.
- **Observed:** The paragraph HTML is identical, but the block delimiter is now `<!-- wp:paragraph {"metadata":{"noteId":[60]}} -->`; the rejected note stays attached to the block as a record. Only a rejected block insertion (RV-11) returned content equal to the original.
- **Expected:** Either the post returns to its original bytes after a reject, or the leftover `noteId` is confirmed as intended (it is what powers "Back to block" on the decided card). Worth a decision because every reviewed block keeps note metadata in `post_content` indefinitely.
- **Likely area:** by design of keeping decided notes, not confirmed in source.

### No bulk review, and self-accept while Suggesting is unremarked
- **Flows:** RV-20, RV-21
- **Severity:** 🟡
- **Relation to August:** F-20 partly fixed
- **Repro:**
  1. Make three suggestions, open "All notes", look for any accept-all / reject-all control (buttons, sidebar filter, command palette).
  2. Stay in Suggesting and click Accept on your own suggestion.
- **Observed:** No bulk control anywhere; each suggestion is decided on its own card. Accept and Reject are enabled in Suggesting intent and apply cleanly. What changed: a floating card beside the block now offers Accept/Reject without opening the sidebar (RV-17), and every decision is provisional until the post is saved.
- **Expected:** Product decision, as in August.

## Fixed since August
- F-20 (canvas-side review affordance, the RV-17 part): floating note cards beside the block carry Accept/Reject with the sidebar closed - RV-17.
- RV-19 half-accepted type-over pair: a type-over is now one `Replace` suggestion with one decision - RV-19 (design change rather than a logged finding).
