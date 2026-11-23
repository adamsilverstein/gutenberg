# Section G findings - Attribute and metadata suggestions

### A text colour suggestion and a font size suggestion on the same block overwrite each other
- **Flows:** AT-04
- **Severity:** 🔴
- **Relation to August:** regression (August recorded one note covering both changes; F-xx: none)
- **Repro:**
  1. Open a draft, switch to Suggesting, select the first paragraph and open the Block tab of the settings sidebar.
  2. Typography > Color > pick "Accent". The paragraph previews in blue; note summary "Change: style, text color default → accent-1"; `metadata.suggestion.after` is `{style: {elements: {link: …}}, textColor: "accent-1"}`.
  3. Font size > click "L".
- **Observed:** The same note is updated (`POST /wp/v2/comments/447` 200) and now holds only `[{type: "attribute-set", attribute: "fontSize", after: "large"}]`. `metadata.suggestion.after` is `{fontSize: "large"}`, the paragraph is back to the default colour (`rgba(0, 0, 0, 0.75)`, classes `has-large-font-size is-suggestion-pending`), and the card reads only "Change: font size default → large". The colour proposal is gone with no notice. In the reverse order (font size, then colour) the font size is dropped instead: operations are `style` and `textColor` only and the preview is back to 18px. Controls: the same clicks in Editing mode leave `textColor: "accent-1"`, the link colour style and `fontSize: "large"` all set; and colour followed by the toolbar's Align text keeps both (`style.typography.textAlign` is merged in, `textColor` stays). Seen in three separate runs: twice in this order, once in the reverse order.
- **Expected:** Both proposals accumulate in the one note, as heading level plus alignment (AT-11) and CSS class plus anchor (AT-06) do.
- **Likely area:** the attribute re-routing in `packages/editor/src/components/suggestion-mode/store-interceptor.ts` (the `metadata.suggestion.after` proposal) when a block-support control in the inspector dispatches several attributes at once, some of them `undefined`. This is a guess; only the Typography panel's colour and font size controls were tried.

### A text alignment suggestion is summarised only as "style"
- **Flows:** AT-02, AT-11
- **Severity:** 🟡
- **Relation to August:** new wording problem (August's summary was "Format: alignment, style", which over-reported but did name alignment)
- **Repro:**
  1. Suggesting mode, select a paragraph.
  2. Block toolbar > Align text > Align text center.
  3. Open All notes.
- **Observed:** The capture is right (`after: {style: {typography: {textAlign: "center"}}}`, centred preview, stored attributes untouched), but the card reads "Change: style". On a heading with a level change as well it reads "Change: heading level 2 → 3, style". Text colour has the same leftover: "Change: style, text color default → accent-1". Other attributes get a named label and values ("font size default → large", "alignment default → wide", "additional CSS class default → …").
- **Expected:** A label that names what changed, for example "text alignment default → center".
- **Likely area:** `packages/editor/src/components/suggestion-mode/suggestion-summary.tsx`, which appears to label top-level attributes only, while text alignment now lives under `style.typography.textAlign` (a guess).

## Observations that did not change a verdict

- AT-08: after an inline "Add" suggestion is rejected, its card summary changes from "Add: “ INLINE”" to "Change: text", so the record of what was rejected is lost from the card.
- AT-05, AT-06, AT-03: an empty original value is worded as "default" ("HTML anchor default → fg-anchor").
- AT-10: the slug control stays editable while Suggesting; it was not exercised here.

## Fixed since August

- F-15 (post title, excerpt, featured image and post status directly editable while Suggesting): fixed. Title edits become a "Title: … → …" suggestion (AT-09); excerpt, categories, tags and featured image become suggestions through the real sidebar controls, status and the other post settings are read-only, Publish is refused with a hint, and a save leaves the stored post unchanged (AT-10).
- F-14 (an attribute suggestion and an inline suggestion on one block): no longer a defect. Co-residence is now supported, both render, and each is accepted or rejected on its own (AT-08).
- Vague attribute summaries noted in the August rows: "Format: classname" is now "Change: additional CSS class default → …" (AT-05) and "Format: metadata" is now "Rename block: “…”" (AT-07).
