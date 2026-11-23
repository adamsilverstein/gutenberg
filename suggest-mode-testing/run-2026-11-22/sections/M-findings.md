No 🟡 or 🔴 flows in this section.

Observation, not a finding: a user who cannot edit a post cannot suggest on it. contributor-user and author-user get 403 from `post.php` and 403 `rest_cannot_create_note` from REST on admin's published post, so Suggestion mode is a mode for people who could already edit, not a way to let read-only roles propose changes. If that is the intent it is enforced consistently.

## Fixed since August
- No finding cited by this section could be re-tested: F-22 (PM-07) needs the experiment off, which this branch does not allow. PM-06's question about a Viewing-mode user broadcasting presence is moot now that Viewing mode is gone.
