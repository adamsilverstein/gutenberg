# Suggestion mode re-run, 2026-11-22 - guide for test runners

You are re-running part of a manual-style test plan against the Suggestion mode combined branch (Gutenberg PR #78994, `try/suggest-mode-combined` at `2bbe377a2fa`). The plan was first run on 2026-08-14 and found 37 findings; most were fixed since. The point of this run is to learn what is true NOW: confirm fixes held, catch regressions, catch new bugs. An honest "could not verify" is worth more than a guessed pass.

## Files

- `AUGUST-PLAN.md` (this directory): the August plan and results. Each section has a table `| ID | Test flow | Description | Result | Passing |`. Use the Description as the steps, and the old Result/Passing as the baseline. Findings F-01..F-37 are under "Findings log". Read only your sections and the findings they cite - the file is large.
- `helpers.ts`: shared helpers (seedPost, openPost, switchIntent, suggestionSaved, getMarkers, getBlocks, getNotes, getSidebarNoteTexts, openNotesSidebar, shot, loginAs, collectConsole, USERS). Read it first. Do NOT edit it (other runners share it); put extra helpers in your own folder.
- `example.spec.ts.txt`: a working example flow.
- Existing e2e specs in `test/e2e/specs/editor/various/suggestion-mode*.spec.ts` show the current selectors, labels and UI affordances. Consult them when a selector from August no longer matches - the UI changed a lot.

## Environment (already running - do not start, stop or rebuild anything)

- Code worktree: `/Users/adamsilverstein/repositories/worktrees/suggest-mode-testing-1122` (built). Do not modify source, do not commit, do not run git commands that change state.
- Site: `http://localhost:8947`, WordPress 7.2-RC2. Users (password `password`): `admin` (id 1), `editor-user` (2, Editor), `contributor-user` (3, Contributor), `author-user` (4, Author).
- Write your specs in `test/e2e/suggest-run/agents/<your-name>/*.spec.ts`, importing `{ test, expect } from '@wordpress/e2e-test-utils-playwright'` and helpers from `'../../helpers'`.
- Run from the worktree root:
  `source ~/.nvm/nvm.sh && nvm use >/dev/null && RUN_AGENT=<your-name> npm run test:e2e -- --config suggest-run/playwright.config.ts` (append `-g "IA-0[1-3]"` etc. to filter by test title). The config forces the base URL to port 8947; never point anything at port 8889 - that is someone else's site.
- Read-only wp-cli, if needed: `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"; WP_ENV_PORT=8947 npm run --silent wp-env-test -- run cli -- wp ...`
- Front-end checks: fetch `http://localhost:8947/?p=<id>` (publish the post first) in a signed-out context.

## Shared-site rules (several runners use this site at once)

- Create your own posts with `seedPost()`; a fresh post per flow unless the flow builds on the previous one. Only touch posts and notes you created.
- NEVER call `requestUtils.deleteAllPosts/deleteAllComments/deleteAllUsers/activateTheme/setGutenbergExperiments/resetPreferences` or anything else site-wide. Never change the `gutenberg-experiments` option, the active theme, or other users.
- No `page.waitForTimeout` as the way to wait for a save: start `suggestionSaved( page )` before the edit and await it after. Short settles before a screenshot are fine.

## What changed since August (apply this when reading old descriptions)

- **Viewing mode was removed** (2026-10-27). Intents are Editing and Suggesting only. For a flow about Viewing: verify there is no Viewing menu item and no `intent-view` shortcut, record that, and mark the flow `➖` (retired) - do not try to test read-only behaviour.
- **The experiment cannot be turned off on this branch** (it is forced on). Flows that need the experiment off: mark `➖` with that reason. Do not try to turn it off.
- A new suggestion no longer opens the notes sidebar; it floats beside its block. Open "All notes" yourself (`openNotesSidebar`) to read note cards.
- Note labels changed (e.g. `Add:`, `Delete:`, `Change:`, `Add formatting:`, `Remove formatting:`); marker classes are `wp-suggestion-add` / `-del` / `-format` etc. Overlapping suggestions are now allowed in many cases that used to be refused (stacked markers).
- A reviewer's Accept/Reject is provisional until the post is saved (`_wp_suggestion_status` `applied-unsaved` / `rejected-unsaved`, final values written by the server on save).
- Do not site-wide switch themes for Site Editor flows; if a flow needs a block theme and the active one will not do, mark it ⬜ with the reason.

## Per-flow protocol

1. Perform the Description's steps as real user gestures (keyboard, mouse, toolbar), not store dispatches. Use store/REST reads only to observe.
2. Observe concretely: markers (`getMarkers`), block attributes (`getBlocks`), notes (`getNotes` + sidebar text), console errors (`collectConsole`). Print them and read the output - do not just assert what you hope.
3. Take at least one screenshot at the proving moment with `shot( page, '<FLOW-ID>-<kebab-detail>' )` (it saves into the results folder).
4. Classify: 🟢 exactly as specified · 🟡 works with a rough edge or open question · 🔴 wrong behaviour, data loss or crash · ⬜ could not run or could not honestly certify (say why) · ➖ retired (feature removed / not applicable on this branch).
5. If a flow fails, first make sure it is the product and not your script (stale selector, missing wait, wrong assumption about new UI): check the existing e2e specs, retry once with a corrected script. Cap it at about three attempts per flow, then record what you saw. If the script could not do the gesture (e.g. real IME), mark 🟡/⬜ "needs manual verification" - never a guessed 🟢.
6. Do not skip a flow because a related one failed.

## Output (write these two files; nothing else outside your agent folder and the screenshots folder)

Results folder: `/Users/adamsilverstein/repositories/worktrees/suggest-testing-docs-1122/suggest-mode-testing/run-2026-11-22/`

1. `sections/<LETTER>.md` per section - one table, every flow of the section present, one row per line:

   `| ID | Test flow | Description | Result | Aug | Now |`

   - ID, Test flow, Description: copied from the August plan (edit the Description only if the feature change makes the old text wrong, and say so in Result).
   - Result: one to three sentences of what actually happened now, with the concrete evidence (marker ids/types/text, note summaries, counts), and how it compares to August ("fixed since August", "unchanged", "regressed", "new behaviour"). Then `<br><br>` and each screenshot as `<a href="screenshots/NAME.png"><img src="screenshots/thumbs/NAME.png" alt="NAME.png" width="300"></a>`.
   - Aug: the August icon. Now: your icon.
   - No hard-wrapped lines; escape `|` inside cells as `\|`.

2. `sections/<LETTER>-findings.md` - one entry per 🟡/🔴 flow group, in this shape:

   ```
   ### <short title>
   - **Flows:** IA-06, IA-07
   - **Severity:** 🔴 or 🟡
   - **Relation to August:** new | regression of F-xx (was fixed) | F-xx still present | F-xx partly fixed
   - **Repro:** numbered minimal steps
   - **Observed:** what happened, with evidence
   - **Expected:** what should happen
   - **Likely area:** file or component if you can tell from the source (optional, say if it is a guess)
   ```

   Also list there, under a heading `## Fixed since August`, each F-xx your flows show is now resolved, one line each with the flow that proves it.

Your final message back should be short: counts per icon per section, the three or four most important findings in a line each, and anything about the environment that got in your way.
