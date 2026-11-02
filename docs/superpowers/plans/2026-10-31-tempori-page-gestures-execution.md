# SDD ledger — plan: docs/superpowers/plans/2026-10-31-tempori-page-gestures.md

Implementation owner: delegated `gpt-6-astra`, requested/configured effort `xhigh`. Root performs independent review. No commits or deployments. Actual secret environment files are never read or loaded.

## Pre-flight and rulings

- Task 0 → 1: repository supplies original Blob and optional format/hash metadata; old local records remain readable by content sniffing.
- Task 1 → 2: discriminated source keeps PDF out of XML playback, metadata and transpose paths.
- Task 2 → 3/4/5: every input uses a controller that flushes annotations before rendering/committing; camera/manual input suspends playback following, not playback.
- Task 4 → 0: migration keeps local annotation identity through persisted account-specific mapping; server deletion does not delete unsynced local originals.
- Ruling: the durable score row itself is the reservation, idempotency record and cleanup queue — avoids independently inconsistent job state; persisted states/leases survive process termination. Cleanup rows have no cascading user FK.
- Ruling: private R2 adapter is independent of image enabled/bucket configuration, but reuses connection fields. Empty or identical public/private bucket fails closed. No infrastructure creation is attempted.
- Ruling: no helper scripts/worktrees/commits; project instructions override skill defaults. This ledger is nonignored.
- Ruling: backend upload completion may recover by deleting abandoned objects after 24h rather than promoting unconfirmed uploads; clients can retry the persistent idempotency key. No original local draft is removed by upload.

## Progress

- Tasks 0–5: implemented and reviewed.
- Task 6: automated and connected Chromium checks complete; live R2/MySQL/native-device acceptance remains pending as detailed below.

## Verification

Final independent results are recorded below. Native camera devices, live R2 configuration and credential-dependent cross-device acceptance remain manual deployment checks.

## Implementation checkpoint

- Task 0: private bucket adapter, immutable JWT principal resolver, quota/idempotency reservation, durable deletion/reconciliation, account deletion and SQL migration implemented. Independent review found and fixed REPEATABLE READ deletion enumeration, email reuse, cleanup starvation, external DOCTYPE compatibility, UTF-16 internal DTD and truncated ZIP handling.
- Task 1: original PDF/MXL/XML recognition and preserved-byte source loading implemented; legacy local loader API retained.
- Tasks 2–5: actual page adapters, shared controller/input, normalized page annotations, Worker-only camera calibration/practice and300/450/700ms settings integrated. Browser verification and lifecycle tests in progress.
- Ruling: cache PDF canvases on demand within current/adjacent indices, at3MP each; no background prefetch queue. At most three cached+visible+destination canvases stay below16MP. Avoids stale prefetch growth while retaining backward/forward reuse.
- Ruling: page mode hides the legacy measure-click range toolbar; its numeric start/end practice settings and stored range remain available. A4 pages preserve physical-measure playback following.
- Ruling: current application translator selects Korean only; new visible controls use the current Korean interface. Existing translation strings for accepted formats were updated.
- Ruling: active managed permissions reject even approved safe template reads/writes. Root `.env.example` creation and `spring_backend/.env.example` read failed. No alternate tool/permission bypass was attempted; variables are documented in the deployment note instead.
- Dependencies: PDF.js6.4.299 and MediaPipe1.2.0 pinned in package and registry lockfile. Shell network DNS unavailable after escalation. Root fetched official tarballs via connected browser and verified SHA512 registry integrity; npm lock-only install succeeded. Existing dependency directory deletion failed during npm reify; new verified package files were extracted without altering existing packages.
- Verification so far: frontend focused77/77 plus Node70/70 and TypeScript pass; backend direct cached Java25 compile and15/15 JUnit tests (no app/context/env startup). Gradle runner fails on its local socket lock even escalated. Browser prototypes verify actual dedicated PDF worker and MediaPipe module worker using synthetic documents/canvas; no camera access or recordings.

## Final implementation and independent review

- Tasks0–5: implemented. Task6 automated/connected-browser verification completed within available environment; live deployment/native acceptance below remains unverified.
- Independent backend and frontend reviewers inspected actual code. Significant findings were validated and fixed: immutable principal ownership, MySQL current-read cleanup, reserved-capacity/idempotency handling, stale account responses/uploads, durable concurrent migration jobs, post-delete explicit migration restart, late camera capture errors, PDF renderer cleanup/cache limits, and compact responsive dock geometry.
- Last authentication review: shared Axios now records the credential actually used, keeps Tempori/refresh on the account token even when POS is signed in, and only clears a failed POS credential if it is still the current one. Auth session revisions, aborted old refreshes, response ownership checks and final request-interceptor guards prevent stale refresh/401/retry results from restoring/clearing another login or sending an old operation with a new account token. New tests were observed RED then GREEN.
- Last backend review: idempotency fields now use unambiguous length prefixes with a distinct absent-field encoding; an absent artist and literal `null` are different requests. Upload attempt UUID is captured by immutable value before the object write, so a refreshed persistence-context entity cannot conceal a superseding attempt. Both regressions were observed RED then GREEN.
- Private download URL creation now holds the owner/score lock through READY verification and signing. New database initialization includes the same table as the explicit deployment migration. A MySQL concurrency integration test was added and compiled, but not executed.
- Account-local pending originals remain visible with an explicit server-list-unavailable warning when initial cloud listing fails. Existing cached lists are not overwritten by failed fetches. Page-mode zoom requests a newly bounded PDF canvas, while reset/page movement returns to fit.

## Verification record

- Before final shared-auth change: full frontend `vitest run --environment jsdom`:74files,328tests passed; Node test suite70/70 passed. Default Vitest invocation instead fails23existing Dieta tests in7files because they run in Node without document/window (305other tests passed). Unrelated test configuration was not changed.
- After final shared-auth change: Axios/account/POS/late-retry + existing resume + Lotto cancellation focused run12/12 passed; TypeScript build and changed-auth lint passed. Repository/migration/Lotto focused run11/11 passed before the final retry guard.
- Java25 direct compile using cached dependencies includes all changed production sources, four unit-test classes and the new MySQL integration-test source. Only unit classes ran:17/17 passed. Gradle itself could not start its local socket-based lock service even after approved escalation. No application context or real environment files were loaded for direct checks.
- Connected Chromium actual UI:390×844,844×390,568×320,1024×768,1440×900; page/dock containment and rotation/page retention verified. Double input, keyboard/boundaries, left swipe, vertical-drag rejection, zoom swipe exclusion, drawing isolation across pages, storage-failure blocked turn and retry were checked. Camera permission-denial and delayed-permission/OFF cleanup used mocks; real module Worker initialized and inferred a synthetic blank frame with the pinned model.
- Synthetic renderer prototypes: OSMD8/100/300measures produced1/3/8A4pages with complete measure mapping; desktop measured46.8/145/304.5ms. Dedicated PDF worker1/20/100blank-page documents rendered correctly. These are synthetic compatibility measurements, not representative rich-score/native-device performance certification.
- PDF zoom browser recheck:595×842 baseline →892×1263 at150% →595×842 on next-page fit; no worker/runtime errors. Theme token recheck passed.
- Scoped `git diff --check` passed. Production build attempt transformed2173modules but failed while removing old generated `frontend/dist/6pick` with EPERM; escalated retry was interrupted before completion. Root will independently build into a new safe temporary output directory with `envDir:false` and no prebuild hook.

## Remaining deployment/device verification

- No real R2 bucket/credentials, signed CORS downloads or authenticated two-device session were exercised. Private bucket, least-privilege credentials, CORS and proxy limits must be configured and tested by the user.
- MySQL concurrency integration tests are compiled only; Docker/Gradle execution remains unverified. Mock unit transaction tests are not substitutes for those database interleavings.
- Native iPhone/iPad Safari, Android Chrome and physical camera direction/latency/false-positive/accuracy/battery tests remain unverified. Camera remains explicitly experimental; no physical camera or microphone was accessed.
- Active permissions prevented approved `.env.example` template reads/writes. The four required configuration names and manual steps are in `docs/tempori-cloud-deployment.md`; actual environment files and existing templates were not modified.
- No commits, deployment, publication, permission changes or external user messages were performed.

## Final independent verification — 2026-11-02 (Asia/Seoul)

- Root ran `node node_modules/vitest/vitest.mjs run --environment jsdom` after all final fixes: **75 files,337 tests passed**, exit0. Log: `/private/tmp/tempori-final-vitest.log`. Default Node-environment Dieta configuration limitation above remains unchanged.
- Root ran `node node_modules/typescript/bin/tsc -b`: exit0.
- Root ran the full Vite API production build with `envDir:false`, cache `/private/tmp/tempori-final-vite-cache`, output `/private/tmp/tempori-final-build`, `emptyOutDir:false`: **exit0**, including SEO prerender. Existing large-chunk warnings remain. Log: `/private/tmp/tempori-final-build.log`. This supersedes the earlier failed attempt to remove old dist output; no denied-directory cleanup or environment loading was performed.
- Root reran direct Java25 compilation and all four unit-test classes after the final fingerprint/attempt/signing fixes: **17/17 passed**. MySQL IT source compiled but was not loaded/executed.
- Root rechecked the final request-interceptor guard: mismatched preserved session/credential provenance is rejected before replacement; absent credentials remove Authorization. The final full jsdom suite includes the regressions.
- Final scoped whitespace check passed. No additional source changes followed these checks; only this verification record was updated.
