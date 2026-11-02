# Execution ledger — plans/2026-11-02-tempori-library-state-sync.md

Single implementation owner; independent review coordinated by parent. Configured implementation model: gpt-6-astra, xhigh (data integrity). No commits/deployment, real environment files, or real migration execution.

Pre-flight: library local/server aliases feed the state identity; upload must copy guest state once without sharing later edits. Cache must finish before viewer mount. All document writers use the same account-bound repository. Server score-row lock serializes state quota, creation, and deletion.

Ruling: preserve existing UI tokens/fonts and card surfaces; put actions behind cards for touch and in desktop popovers. This is an existing-screen change, not a redesign.
Ruling: legacy annotation data remains untouched; migrate only valid documents into layout-specific state, retaining incompatible data in legacy storage. Incorrect layout attribution would misplace ink, so ambiguous wrapped legacy data is not auto-assigned.
Ruling: user AGENTS workflow overrides missing helper scripts/mandatory commits and worktrees. Ledger stored in nonignored plans; verification uses safe configs with envDir:false.

Baseline: existing changes to .gitignore and plans are parent/user work, preserved. Latest web interface guidelines fetched before UI review; relevant fixes include full-width rows, independent menu button, keyboard/Escape handling, hidden actions excluded, reduced motion.

## Progress and evidence

- Implementation started: library tests and account/cache boundaries.
- Repository new behavior tests observed RED (guest omission, exact quota/network errors), then 11/11 GREEN. Menu tests observed missing component RED, then 2/2 GREEN.
- State service tests observed missing API/entity RED; current domain Java compilation + 20/20 unit tests GREEN. Tests use mocks, not actual DB locks.
- State engine 6/6 focused tests GREEN: immutable in-flight replay, editing during PUT, stale conflict choices, account switch, no guest API, durable guest/account fork.
- Root independent browser fixture found desktop action overlap, synthesized-click menu closing, and dark-mode colors; corrected elevation/click handling/theme variants.
- Root independently verified migration script with mocked docker: original→state SQL order, literal container credential indirection, exit9 propagation/no false success; bash -n passed. Actual Docker socket unavailable even escalation, so MySQL integration cannot run here.
- Viewer integration now includes account-scoped provider, explicit conflict controls, per-score practice/BPM, physical MusicXML measure+progress and PDF page+normalized-scroll position. No playback auto-start. Provider pauses display adoption while playing/drawing/settings open; pending requests remain durable.
- Ruling: retain synchronous annotation flush using an isolated per-mutation localStorage recovery journal, then atomically persist payload/outbox in IndexedDB. Recovery includes the rendered generation, so crash replay cannot silently overwrite another tab. BroadcastChannel updates other tabs; generation CAS protects simultaneous/stale edits even before notification.
- Ruling: upload forks a durable snapshot before the upload request; later guest edits stay on the guest side. Separate state-seed marker retries partial initialization without reuploading a successful original. Existing pre-feature mappings receive their first snapshot on initialization.
- Reviewer-confirmed fixes: definitive 413 retires rejected tuple, while uncertain network errors replay identical tuple; cross-tab conflicts stay dirty on either chosen local copy; remote apply increments content generation; queued layout sync runs after an active default sync rather than dropping requested keys.
- Current typecheck GREEN. Focused Tempori Vitest 24 files / 100 tests GREEN. Root actual Chromium real IndexedDB tests confirmed atomic concurrent document writes and two-tab generation increments (not backend concurrency). Native Safari and actual MySQL remain unexecuted.

## Final review and verification — 2026-11-03

Source frozen after independent review. Parent coordinated separate frontend/data-integrity reviewers and browser verification; final targeted reviewer reported no remaining material findings.

- Final full frontend Vitest with explicit jsdom and envDir:false: **78 files, 366/366 tests passed**. Authoritative parent logs: `/private/tmp/tempori-state-final-vitest.log`.
- TypeScript project build: **exit 0**.
- Production Vite build with envDir:false: **exit 0**, SEO outputs generated. Existing dynamic-import/chunk-size warnings remain. Parent log: `/private/tmp/tempori-state-final-build.log`.
- Direct Java compilation and domain unit tests: **22/22 passed**. Integration test sources compiled; tests requiring actual MySQL were not executed. Parent log: `/private/tmp/tempori-state-final-java.log`.
- Scoped git diff whitespace check and `bash -n scripts/migrate-tempori-prod.sh`: **exit 0**.
- Focused lint: **no errors**; existing and some hook/Fast Refresh advisory warnings remain. No failed lint gate.
- Actual Chromium, production components/CSS: 320/390px phone and 768px tablet full-width rows, desktop popover clickability, delete/upload ordering, Escape focus return, one-row-open behavior, synthesized touch drag/click suppression, guest actions, and dark-theme rules checked. Synthetic pointer capture was shimmed for untrusted events; this is not native Safari verification.
- Actual React viewer/provider with synthetic MusicXML in isolated Chromium: page annotation persisted/reopened, BPM96 persisted/reopened, page2 restored via physical measureIndex40/progress0. Active unfinished pen stroke persisted on unmount and reopened with both strokes. Playback was not automatically started.
- Actual Chromium IndexedDB: independent practice/position updates and concurrent same-document updates serialized; two pages each made ten concurrent updates without lost generation increments. This does not prove real backend concurrency.
- Mocked production migration script: original-table SQL precedes state-table SQL, Compose/container credential indirection remains literal, injected docker exit9 propagates without false success. No real environment files read or real containers/migrations run.

Validated review fixes include: score-state bulk deletion with repeatable-read snapshot safety; bounded mutation receipts with safe stale retry conflict; no discarded edits during PUT; definitive quota rejection can be repaired; account-change late responses discarded; cross-tab generation conflicts; independent document sync; exact displayed recovery ancestry; unrelated recovery branches retained; over-limit drafts visible until repaired and retired without resurrection; teardown flush registration order; upload state seeding and retry separate from original success; known-layout legacy page notes seeded during upload; download error wording preserved by route UI.

Ruling: old wrapped and horizontal ink without reliable renderer/layout/transposition identity is retained unchanged and accompanied by a preservation notice instead of guessing coordinates. Known-layout legacy page notes migrate once. This avoids misplaced ink; the older ambiguous copies require a later explicit recovery workflow if the user needs them in the new layout.

Ruling: document generation advances when remote content changes. A stale rendered editor becomes an explicit local-tab conflict, and choosing either local branch stays dirty until acknowledged by the server. No client timestamp chooses a winner; recovery timestamps only order which retained draft is initially shown.

Remaining limitations: real MySQL transaction/retention integration tests (Docker socket unavailable even after allowed escalation), production migration, live R2/backend two-device synchronization, and native iPhone/iPad Safari/offline gestures are unverified. Operators must perform those checks in their configured environment. No environment variables were added, changed, or removed. No actual `.env` files were touched. No commits, publishing, merging, migration execution, or deployment was performed.
- Final parent changed-file oxlint: exit0 with 13 nonblocking warnings (hook dependencies, existing annotation callbacks, and provider mixed exports/Fast Refresh). Warning-free lint is not claimed; hook behavior was independently reviewed and browser-tested.
