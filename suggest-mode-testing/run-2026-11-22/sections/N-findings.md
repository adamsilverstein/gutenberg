# Section N findings (AX-01 to AX-07)

### Keyboard review works, but focus is dropped to the document after Accept
- **Flows:** AX-03
- **Severity:** 🟡
- **Relation to August:** new (August did not run this flow)
- **Repro:**
  1. In Suggesting, make two additions in two paragraphs.
  2. Using the keyboard only: Tab from the canvas to the floating note's `Accept suggestion` and press Enter. Or Ctrl+` to the top bar, Tab to All notes, Enter, Tab to `Accept suggestion`, Enter.
  3. Read `document.activeElement`.
- **Observed:** Accept and Reject are both reachable and operable by keyboard on both paths, each stop with a computed `outline: solid 2px rgb(56, 88, 233)`. After Accept the active element is `document.body` (no focus ring, `:focus-visible` false); after Reject focus lands on the editor canvas instead. The notes search input has no outline or box-shadow of its own when focused (its ring, if any, is drawn by a wrapper - not confirmed).
- **Expected:** After a decision, focus moves somewhere deliberate and consistent (the next pending note, or back to the block), never to `body`.
- **Likely area:** `packages/editor/src/components/collab-sidebar/suggestion-actions.tsx` - the Accept button unmounts when the card changes to its "Applied" state (a guess).
- **Still needs a human:** that the focus ring is actually visible on every background, and a real screen-reader pass of the whole review.

### Block-level pending treatments: a removed image looks untouched, and three of four treatments say nothing in the canvas
- **Flows:** AX-07 (visual), AX-02 (the non-visual gap noted there)
- **Severity:** 🟡
- **Relation to August:** new; the canvas-semantics part is what is left of F-23 / F-24 after their fixes
- **Repro:**
  1. In Suggesting, delete an image block and a paragraph block (block Options → Delete), change a heading's level, and press Enter after a paragraph and type a new one.
  2. Deselect and look at the canvas; then inspect each pending block's accessible name and description.
- **Observed:** Visual: `.is-suggestion-pending-remove` is styled only with a dark red text colour and `text-decoration: line-through` (no outline, border, background, opacity, filter or pseudo-element). On a paragraph that is a clear strikethrough; on an image nothing is drawn, so the image looks unchanged while its note says `Remove block: image`. A pending attribute change (`.is-suggestion-pending`) is a solid blue outline on `::after`, which reads as the block-selection outline rather than a suggestion. Non-visual: in the canvas only the pending move speaks (visually hidden "Suggested move destination." before the block, and the ghost as a `note` "Original position of moved List block."); pending-insert, pending-remove and pending-attributes blocks have `aria-label` "Block: Paragraph / Image / Heading 2" and no description, `aria-describedby` or hidden text. List View does describe all four.
- **Expected:** Every pending block treatment is visible whatever the block contains (an image needs an outline, overlay or badge like the "Suggested move" tag), is distinguishable from selection, and is announced in the canvas the way the move already is.
- **Likely area:** the pending-treatment styles in the block editor content stylesheet for `.is-suggestion-pending-remove` / `.is-suggestion-pending`, and the component that renders the visually hidden "Suggested move destination." text (a guess).

## Observations (no flow downgraded)
- AX-02: the marker announcements are CSS generated content (`::before` / `::after` on `span.wp-suggestion-a11y`). Chromium's accessibility tree includes them; whether VoiceOver, NVDA and JAWS read them inside a contenteditable needs a real screen reader.
- AX-04: no dark rendering exists to test (`prefers-color-scheme: dark` changes nothing in the canvas). Contrast was measured for one author; marker colours are per suggestion type.
- AX-06: 200% was emulated as a 720x450 CSS viewport at device pixel ratio 2. Text-only zoom and non-Chromium browsers were not covered.
- AX-07: the lowest floating card extends under the editor footer (its Accept button at y=877 sits beneath the block breadcrumb) until the canvas is scrolled; ordinary clipping, no click is stolen once scrolled.

## Fixed since August
- **F-23** (suggestion markers carry no accessibility semantics) - AX-02: `insertion` / `deletion` roles plus "Start/End of suggested … by admin." announcements on add, del and format markers.
- **F-24** (pending block treatments invisible in List View) - AX-05: all four pending kinds have a row class and an accessible description.
- **F-25** (possible horizontal overflow at 200% zoom) - AX-06: not reproduced at an emulated 200% (no horizontal scroll in page or canvas).
