# Section A findings (MS-01 to MS-11)

No 🟡 or 🔴 flows in this section. Six flows 🟢, five ➖ (MS-01, MS-02, MS-07 need the experiment off, which this branch does not allow; MS-04, MS-11 are about the removed Viewing mode).

## Observations (no flow downgraded)

### Code editor radio looks available in Editing while suggestions are pending
- **Flows:** MS-10
- **Severity:** papercut, flow stays 🟢
- **Relation to August:** new (a side effect of the F-04 fix)
- **Repro:** 1. In Suggesting, type an addition and let it save. 2. Switch to Editing. 3. Open Options and look at "Code editor", then click it or press ⇧⌥⌘M.
- **Observed:** The radio has no `aria-disabled` and no explanatory description, but the switch is refused with the snackbar "The code editor is unavailable while this post has suggestions to resolve. Accept or reject them first." The text editor never shows; 7 blocks, marker and note intact.
- **Expected:** Same affordance as in Suggesting, where the radio is `aria-disabled="true"` and carries the reason, so the refusal is visible before the click.
- **Likely area:** `packages/editor/src/components/mode-switcher/index.jsx` (a guess: its comment says the disabled state uses an intent-only check and skips the pending-marker probe).

## Fixed since August

- F-01 (Enter splits a block in Viewing): no longer applicable, Viewing mode was removed - MS-04.
- F-02 (inserter live in Viewing): no longer applicable, Viewing mode was removed - MS-04.
- F-03 (intent shortcuts registered where they cannot work): fixed - MS-09. On a `wp_template` the three shortcut names have zero key combinations and the Keyboard shortcuts modal lists no "Switch to ..." rows.
- F-04 (raw HTML edits in the code editor while Suggesting): fixed - MS-10. Menu item disabled with a reason, shortcut refused with a snackbar, command palette offers no code editor command.
