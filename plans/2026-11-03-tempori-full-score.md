# Tempori Full Score Implementation Plan

**Goal:** In score mode, minimize menus and margins so PDF and MusicXML use the available screen, without entering browser fullscreen or changing page mode.

**Architecture:** Keep the existing viewer frame and portal dock. Collapse secondary controls into one persistent menu panel; keep exit, playback, page navigation and active camera stop discoverable. Preserve score, annotation, sync and playback lifecycles.

**Tech stack:** React 19, TypeScript, existing CSS and Vitest; actual browser acceptance by parent reviewer.

**Spec:** User: “악보모드에서는 악보가 전체 보기로 보였으면 좋겠어”; clarification: “메뉴·여백을 최소화해 악보가 화면 전체를 사용”.

## Constraints and design

- Never access real environment/secret files or process environment; no deployments or commits.
- Preserve user work and data contracts. No persistence/auth changes.
- Keep existing paper palette (#fff paper, #000 notes, #222 controls, #d0d0d0 borders, #4f46e5 focus/annotation selection), inherited typography, 44px hit targets.
- Main score starts at safe-area top; no 1100px cap, title block or decorative frame. The accessible h1 remains available; title/artist are also in the menu.
- Bottom row: library exit, menu, compact page navigation when needed, playback. Narrow screens may wrap page navigation to maintain touch targets. Secondary controls expand above it, with overflow scrolling and Escape/focus return.
- Menu children remain mounted. Active camera panel/stop stay outside the hidden menu. Sync conflicts/errors remain outside it.

## Review focus

- PDF and MusicXML pages retain usable prev/next and annotation save/flush behavior.
- Wrapped/horizontal modes gain viewport width and lose title/stats/range chrome.
- Mobile portrait/short landscape retain reachable exit/playback and safe areas.
- Opening/closing menus preserves state and keyboard focus; active camera can always stop.
- Existing practice settings dialogs, errors and sync resolution remain reachable.

## Task 1: Full-screen score surface and compact controls

**Files:** `frontend/src/components/TemporiViewerDock.tsx` and tests; `frontend/src/pages/TemporiPage.tsx`; `frontend/src/features/tempori/Tempori.tsx`; `frontend/src/features/tempori/pages/{ScorePageViewer,PdfTempori,PageTurnBar}.tsx`; `frontend/src/features/tempori/pages/camera/CameraTurnSettings.tsx`; `frontend/src/index.css`.

- [x] Add and observe failing tests for default-collapsed secondary controls, preserved control state and persistent playback/exit/status.
- [x] Implement menu portal slots and full-width, safe-area score surface; move secondary chrome into the menu without changing persistence.
- [x] Run focused Vitest, full frontend test suite, lint and TypeScript. Build with `envDir:false` and fresh temporary output.
- [x] Independent code review and browser acceptance across PDF/MusicXML modes, desktop/mobile/landscape; fix findings and rerun affected checks.

## Plan review / execution ledger

- Self plan review: covers all source/layout modes, state preservation, errors and camera stop. Absolute menu overlays do not inflate reserved dock height; only the persistent dock is reserved. No API/storage migration needed.
- Preflight: shared slots are defined once by viewer frame, consumed by all score renderers with standalone fallback. Existing `getScoreViewport` remains authoritative.
- Ruling: use existing `plans/` instead of skill default storage; no missing helper scripts/worktree/commit ceremony, per project instructions.

## Task 2: Mobile download failure diagnostics

**New requirement:** User reports the existing generic original-download error on mobile. The actual failing boundary is unknown; preserve behavior and surface only a fixed diagnostic code alongside the exact existing Korean message.

**Files:** new `services/temporiDownloadError.ts` and tests, `services/temporiCloudApi.ts` and tests, `services/temporiRepository.ts` and tests, `pages/TemporiPage.tsx` and tests.

- [x] Test fixed code sanitization, boundary stage distinctions, existing 401/403 signed URL retry and cancellation, cache fallback, page retry/reset on score and account changes.
- [x] Add allowlisted stages/reasons without storing/exposing URL, token, ID, raw error message/name/cause. Preserve cache completion, integrity checks and session guards.
- [x] Focused tests, independent review, full jsdom suite, TypeScript and safe temporary production build.

Plan review: root approved stage-only diagnostics; this instruments the mobile failure and does not establish or fix its cause. Auth, cache policy and data formats remain unchanged.

## Final evidence and limitations

- First dock tests observed three expected failures, then passed. Review caught portal Escape bubbling, hidden parent practice settings, unsupported page range selection, keyboard focus order and mobile shell padding; fixes covered by focused component tests and browser recheck.
- Parent browser evidence (isolated actual-component Chromium, generated score fixtures): desktop 1440px wrapped full width; MusicXML pages and horizontal; landscape 844×390 score viewport 0–334px with dock 338–386px; mobile 390px content x=0 width=390; PDF real parser with fake worker rendered two pages and advanced; 768px, 390px and 320×568 PDF had no horizontal overflow. All primary mobile actions retained 44px targets. Menu/settings close restored playback; page range action absent.
- Independent fullscreen reviewer and mobile-diagnostic reviewer found no remaining blockers. Diagnostic reviewer independently ran 37 affected tests.
- Final `npm test -- --environment jsdom`: 80 files, 390 tests passed. Log `/private/tmp/pbb-full-score-tests.log`.
- Final `npx tsc -b`: exit 0. Log `/private/tmp/pbb-full-score-types.log`.
- Final Vite production build: exit 0 with `envDir:false`, fresh temporary output; expected chunk-size/dynamic-import warnings. Log `/private/tmp/pbb-full-score-build-final.log`.
- Focused lint: exit 0, zero errors, nine warnings (existing hook warnings plus nonblocking HMR mixed-export and ref-cleanup warnings). Report `/private/tmp/pbb-full-score-lint-final.json`. Global `npm run lint` fails on existing generated PDF.js assets and existing source diagnostics; not treated as a clean global lint run.
- Bare `npm test` still uses node environment and fails 23 preexisting Dieta DOM tests; explicit jsdom suite above passes. Direct Node focus-mode test command could not resolve existing extensionless TypeScript imports; no assertions ran in that attempt.
- Native iPhone/Safari and real cloud/backend download paths remain unverified. Diagnostic instrumentation does not claim to fix the live mobile root cause. No deployment, commit, environment-variable or secret-file changes.
