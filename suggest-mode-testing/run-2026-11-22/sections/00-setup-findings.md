### On a fresh site every suggestion is refused with 403 and nothing tells the user
- **Flows:** found during environment setup, before any flow; it blocks every flow that creates a suggestion
- **Severity:** 🔴
- **Relation to August:** new (bundle-only: introduced by `5013f2d36e49` "Bundle: report the Suggestion mode experiment as on to server code", 2026-11-18)
- **Repro:**
  1. Start a site that has never saved the Experiments screen, so the `gutenberg-experiments` option has no row in the database (a fresh wp-env, and presumably a fresh Playground).
  2. Open a post, switch to Suggesting, type a word.
- **Observed:** the marker appears in the canvas, but `POST /wp/v2/comments` returns `403 {"code":"rest_suggestions_unavailable","message":"Suggestions are not available for this post."}` on every attempt. No note is ever created. Inside the REST request `gutenberg_is_experiment_enabled( 'gutenberg-suggestion-mode' )` is `false` and `get_option( 'gutenberg-experiments' )` is `[]`, while the same calls from wp-cli return `true`.
- **Expected:** the bundle forces the experiment on for the editor, so the server should agree and accept the write.
- **Cause (verified):** `gutenberg_force_suggestion_mode_experiment` is hooked on `default_option_gutenberg-experiments` at priority 10. On `rest_api_init`, `gutenberg_initialize_experiments_settings()` calls `register_setting( ..., array( 'default' => array() ) )`, which adds core's `filter_default_option` to the same hook, also at priority 10 but later. When the option has no row and no default was passed, `filter_default_option` returns the registered default `array()` and throws away the forced value. It only happens in REST requests, because that is the only place the setting is registered, and REST is where the check matters.
- **Likely area:** `lib/experimental/editor-settings.php` - hook the `default_option_` filter at a priority above 10, or have `gutenberg_suggestions_enabled()` not depend on the option on this branch. Does not affect the reviewable stack, where the gate is real.
- **Workaround used for this run:** wrote `gutenberg-experiments = { "gutenberg-suggestion-mode": true }` straight to the options table (a plain `wp option update` reports "unchanged" because the `option_` filter already fakes the value).
