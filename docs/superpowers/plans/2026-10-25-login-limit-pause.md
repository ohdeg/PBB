# Temporary login rate-limit pause

Status: Reverted at the user's request on 2026-10-25. Restored the original login limiter call and the integration test expecting HTTP 429 on attempt 11. Restoration plan/review: reverse only the two temporary edits, verify both files match HEAD, preserve unrelated work. Runtime verification remains blocked by the same access constraints below.

Goal: Temporarily remove login attempt limits as requested, preserving credential validation and all other request limits.

Implementation owner: current agent. Use executing-plans directly; no helper scripts or commits.

Plan review: The only production change is bypassing checkLogin in AuthService.login. Keep the limiter implementation for restoration. No API, environment, data migration or token changes. This applies to every deployment of this code and does not automatically expire; restart is required. Existing Redis counters need not be deleted.

- [x] Update AuthRateLimitIT so more than ten invalid login attempts remain 401, while email cooldown remains 429.
- [x] Remove the login limiter call with an explicit temporary-restoration comment.
- [x] Review the actual diff independently and check whitespace.

Review: independent gpt-6-astra / xhigh reviewer found no actionable defects. Scoped git diff --check passed. Runtime tests/build remain unexecuted under the access constraint below.

Validation constraint: Gradle consumes ignored .gradle/build paths; execution is prohibited by workspace access rules. Do not run Gradle or the app, or read real .env files. Report integration tests as unexecuted; the user can run them locally.
