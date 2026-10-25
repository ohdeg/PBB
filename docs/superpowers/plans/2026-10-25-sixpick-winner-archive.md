# 6PICK Winner Archive Implementation Plan

**Goal:** Settle each saved pick against its own published draw, retain winners in a separate archive, and persist changes and notification acknowledgement safely.

**Architecture:** Add pure migration/settlement/history-scope utilities and a focused account-scoped persistence hook. Keep the existing array JSON contract and backend 200,000-character limit; add item fields without schema changes. LottoPage integrates two accessible history tabs and visible persistence/retry feedback using its existing blue/slate/amber design.

**Tech stack:** React 19, TypeScript, Vitest/Testing Library; existing Spring JSON persistence.

**Spec:** User requirements supplied in this conversation; user AGENTS.md workflows govern safety and validation.

## Constraints and review focus

- Never access real environment files, ignored paths, dependencies or generated artifacts. No environment variable changes.
- User initially deferred execution, then authorized actual validation after starting DB/Redis. Environment/ignored-path restrictions still apply; current validation evidence and remaining blockers are recorded below.
- No startup save/clear before successful hydration. Invalid saved JSON fails visibly instead of becoming an empty history. Serialize PUTs; failures preserve local edits and expose retry. Do not use clear endpoint for normal empty snapshots.
- Stable account identity owns history; token refresh must not reload it. Account changes suppress old data immediately and invalidate stale async reads/writes. Never start a queued write for a different account.
- Complete results require a valid round, six distinct main numbers and a valid distinct bonus. Unknown item round, malformed pick or incomplete draw remains pending. Preserve won entries unless explicitly deleted.
- Migration assigns a valid legacy root targetRound only when an item lacks a valid round. Rank 1: six mains; 2: five+bonus; 3: five; 4: four; 5: three. Delete only settled losing pending entries.
- Persist win acknowledgement on item only on dismiss or archive CTA. Pending acknowledgement save failure remains visible and retryable. Notice uses only exact approved copy and no rank/count/numbers.

## Files and tasks

### 1. Settlement and migration contract

- [x] Extend `frontend/src/types/lotto.ts` with optional per-item `targetRound`, `status`, `prizeRank`, `winAcknowledged` (legacy compatibility).
- [x] Write `frontend/src/features/lotto/utils/lottoHistory.test.ts` for all ranks, misses, round matching, incomplete/invalid results, immutable winners, legacy fallback/unknown round, descending archive and scoped selection/deletion/export.
- [x] Implement `lottoHistory.ts`: `migrateLottoHistory`, `settleLottoHistory`, `getHistoryForTab`, scoped action helpers and privacy-safe notification selector. Preserve item metadata and unchanged references when no settlement occurs.
- [x] Write `frontend/src/api/lottoApi.test.ts`; remove 200-item truncation and reject malformed JSON/shape visibly. Preserve server cap/error message.

### 2. Reliable account-scoped persistence

- [x] Write `frontend/src/features/lotto/hooks/useLottoHistory.test.tsx` using deferred promises for hydration/save races, retry, nonempty/empty hydration, token refresh, account switch, serial saves, stale completion, and acknowledgement persistence.
- [x] Implement `useLottoHistory.ts`: account identity, ready/loading/load-error/save-error/saving states, mutation journal during hydration (replay edits after load), serialized snapshots, revision tracking and explicit retry. Stale account data is hidden synchronously and stale responses ignored. Server snapshots never replace edits made after a save began.
- [x] Apply settlement after successful hydration and result updates; winners without acknowledgement can notify until dismiss/CTA is saved. Persist settlement before presenting the notice where practical; never acknowledge merely on render/focus.

### 3. Existing UI integration

- [x] Replace destructive whole-history publication clearing and page persistence effects with hook. New entries receive their targetRound and pending state. Guard long-running generation against changed account ownership.
- [x] Add keyboard-operable `이번 회차` / `당첨 보관함` tablist with arrow/Home/End behavior, selection clearing, tab-specific empty messages, per-item round/rank/status and older-waiting label. Archive sorts newest round first.
- [x] Scope select-all, bulk delete/download and individual actions to active tab; confirm archived deletion. Export includes round/rank through shared badges.
- [x] Add polite win notice with dismiss and archive CTA; add visible load/save error with retry and loading status.
- [x] Replace nested clickable-card interaction with native selection checkbox; label icon actions, add focus styles, wrap narrow toolbar, remove card hover transforms/transition-all.
- [x] Add focused component tests for tab selection/action scoping and privacy/CTA as practical.

### 4. Review and deferred verification

- [x] Static self-review against requirements and UI guidelines; independent Astra review inspected the actual diff and identified three validated findings, all fixed below.
- [x] Fix validated significant findings, re-read affected paths and run scoped `git diff --check`.
- [x] Record exact changed paths, written tests and explicitly unrun checks. Tests authored only, not run; no test/build/browser success claims, commit or deployment.
- [ ] Runtime validation now authorized: complete Vitest suites/build/lint/typecheck, DB round-trip, and browser/responsive checks once the network and dependency blockers below are resolved.

## Plan review decisions

- Existing Spring service accepts arbitrary item fields in JSON and rejects oversized payload; no backend schema/service overhaul needed.
- Backend limit remains intentional and visible. Long archive export remains existing image capture approach; no silent pruning.
- Existing font and visual palette are retained; design improvement centers on meaningful archive/status hierarchy and accessible controls.


## Review corrections and implementation evidence

- Plan review: all picks GET/PUT carry an owner AbortController; synchronous auth subscription cancels before Axios retries, and a version restarts batched A→B→A sessions. Same-owner token rotation keeps history. Generation also captures identity epochs.
- Plan review: only absent legacy pending item rounds inherit root targetRound. Explicit null/invalid rounds and archived unknown rounds stay unknown; subsequent saves use root null.
- Plan review: current-week notification copy requires a valid drawDate in the current Korean Monday–Sunday week, no later than today; historical/unknown dates use generic approved copy. Dismiss/CTA acknowledgement stays visibly pending until its snapshot saves successfully.
- Plan review: guest history is not imported into an account. Account-local append/delete/ack commands replay over successful authoritative hydration; no stale whole-array replacements.
- Code review fix: size-cap errors now explain that changes remain unsaved and suggest exporting images, deleting unwanted records, then retrying. The backend 200,000-character cap is unchanged.
- Code review fix: initial authoritative draw readiness gates generation both in the handler and button, with visible failure/retry; delayed results cannot label new picks as historical round 1. A successful empty result is distinguished from unknown/failed data.
- Code review fix: account changes clear hidden export content and invalidate capture epoch; capture checks owner/epoch before work and after toPng; unmount and newer captures cancel old downloads. Export subtree is hidden from accessibility APIs.

Tests authored (not executed): `lottoHistory.test.ts`, `useLottoHistory.test.tsx`, `LottoHistoryPanel.test.tsx`, `lottoApi.test.ts`, `lottoApi.ownerCancellation.test.tsx`, and `LottoPage.history.test.tsx`. Sources cover ranking/migration/incomplete results, tab actions, privacy and Korean week boundaries, hydration/save/delete/ack races, account refresh/switch/reload, actual Axios refresh replay cancellation, initial draw readiness, and export ownership.

Implementation-stage static evidence: scoped `git diff --check` passed for tracked code after final implementation. Original Vitest suites and app/build/browser execution were initially deferred; subsequent actual verification is recorded below.

## Actual validation attempt — 2026-10-25

- PASS: `/opt/homebrew/bin/node --test /private/tmp/pbb-sixpick-native-verification-20261025.mjs` directly imported the actual `lottoHistory.ts` source using native TypeScript support. **15 tests passed, 0 failed**: ranks 1–5, loser removal, unknown/incomplete data retention, archive immutability, legacy migration, sorting/action scope, exact private notice copy, and Korean week boundaries. This standalone dependency-free check is not a run of the original Vitest suites.
- DB schema: code uses the existing `lotto_user_picks.items` JSON column; no new DDL is required by this feature. The live schema and data round-trip remain unverified. No DB writes or migrations were executed.
- BLOCKED: Docker socket access was denied even after an escalated retry. Direct MySQL TCP `127.0.0.1:3306` and Redis `PING` at `127.0.0.1:6379` also returned `Operation not permitted`, including escalated retries. Listening ports alone are not proof of service health.
- A fresh validation workspace at `/private/tmp/pbb-sixpick-validation-1bckskkh` contains 322 safe Git-listed frontend files. No actual environment files, original ignored dependencies, or ignored build artifacts were copied.
- BLOCKED: sanitized staging `npm ci` failed with `getaddrinfo ENOTFOUND registry.npmjs.org`. The escalated retry was interrupted without a result, so neither its success nor denial is claimed. Initial npm session ended; no validation app server was started.
- NOT RUN: six original focused Vitest suites, full suite, build/typecheck/lint, browser/responsive behavior, and real backend persistence. These checks require available dependencies and permitted local service connectivity.
