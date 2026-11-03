# Tempori PDF tap navigation implementation plan

**Goal:** Turn PDF pages with a short tap/click on either half of the score, retain the small page counter, and move PDF navigation buttons into the existing menu.

**Architecture:** Extend the existing pointer recognizer with PDF-only tap recognition, tracking all movement and interruptions while retaining existing swipe/keyboard requests. `ScorePageViewer` owns eligibility and first-use guidance; `PageTurnBar` uses the existing dock slots for a compact PDF counter and menu navigation, preserving MusicXML controls.

**Tech stack:** React 19, TypeScript, existing dock/CSS, Vitest and Testing Library (explicit jsdom).

**Spec:** User-approved requirements supplied in the parent task and AGENTS.md.

## Constraints and review focus

- Never access actual environment/secret files or process environment. No commits, deployment, worktrees, dependency changes or helper scripts.
- Keep swipe, keyboard, camera, annotation, zoom, and MusicXML behavior. Page requests still use the existing controller.
- Tap only with one primary mouse/touch pointer, left mouse button, short duration, movement within tolerance throughout the path; cancel on scroll, pointer cancel/loss, leaving viewport, multitouch, disabled state or controls. A swipe emits one request and never a tap.
- Disable tap during annotation/eraser, app/native zoom, settings/camera dialogs, busy/error/loading. Check native viewport zoom at gesture dispatch as well as React state.
- Hint copy: `왼쪽은 이전 · 오른쪽은 다음`; show only when a PDF is ready and eligible, time out after 5 seconds or dismiss after tap, persist a safe local preference, tolerate unavailable storage.
- Preserve accessibility with previous/next buttons in the existing menu and existing arrow/PageUp/PageDown keyboard support, plus live page counter.
- Preserve current Tempori color/type/spacing. Keep PDF counter on the main dock row at mobile widths without changing MusicXML layout.

## Task 1: Gesture behavior

- [x] Add meaningful hook tests for half selection, PDF opt-in, movement/path return, scroll, cancel, nonprimary/rightclick/pen/control, multitouch, disabling midgesture/native zoom, swipe single dispatch and keyboard.
- [x] Run focused tests and confirm expected RED for missing tap/path safety.
- [x] Extend hook options with `tapEnabled`; add `tap` origin, movement/scroll cancellation and viewport boundary checks, forwarding move/scroll handlers in viewer.
- [x] Run hook tests to GREEN.

## Task 2: Viewer, guidance and dock

- [x] Add tests for PDF compact counter/menu controls, unchanged MusicXML buttons, viewer gating, hint lifecycle/persistence/storage failure, and pointer integration.
- [x] Confirm expected RED, implement PDF-only eligibility, safe first-use hint and menu navigation, compact counter CSS.
- [x] Run affected tests to GREEN and inspect actual diff against UI guidelines.

## Task 3: Verification and review

- [x] Run complete Vitest suite with explicit jsdom, type checks, envDir:false production build to a temporary output, scoped lint.
- [x] Parent independent code review and browser/responsive checks; implement validated corrections and rerun affected verification.
- [x] Record actual results and limitations. No environment variable changes expected.

## Execution record

- Plan self-review: requirements, compatibility, meaningful edge cases and accessible fallback covered; one owner executes sequentially. Parent reviews plan before implementation.


### Final implementation and verification ledger

- Task 1 complete: PDF opt-in tap recognition, 350 ms/10 px accumulated path limits, primary mouse/touch guards, modifier/control/dialog exclusion, global multitouch/outside-release bookkeeping, scroll/cancel/leave/lost-capture cancellation and live native zoom checks. Existing controller remains the only turn path. Hook RED → GREEN recorded in `/private/tmp/tempori-pdf-tap-red.log` and `/private/tmp/tempori-pdf-tap-hook-green.log`.
- Task 2 complete: ready PDF tap integration, noninteractive five-second Korean hint and safe optional local preference, compact live counter with accessible menu buttons, MusicXML controls preserved. Integration RED → GREEN in `/private/tmp/tempori-pdf-tap-ui-red.log` and `/private/tmp/tempori-pdf-tap-ui-green.log`.
- Independent reviewer found an implicit-touch-capture edge excursion: leaving and returning within 10 px could tap without pointerleave. Reproduced RED and fixed by checking every current/coalesced movement coordinate against viewport bounds; affected tests GREEN in `/private/tmp/tempori-pdf-tap-review-green.log`. Reviewer rechecked and found no remaining significant issue.
- Final full suite initially exposed an asynchronous test readiness race: score content is installed in a layout effect before the passive hint appearance effect. Changed only the assertion to await the visible hint. Final focused suite: 26/26; full suite: 82 files, 416/416. Logs `/private/tmp/tempori-pdf-tap-final-focused.log` and `/private/tmp/tempori-pdf-tap-final-suite.log`.
- `tsc -b`: passed, `/private/tmp/tempori-pdf-tap-final-types.log`.
- Core Vite production build: passed, `/private/tmp/tempori-pdf-tap-final-build.log`; `envDir:false`, temporary output `/private/tmp/tempori-pdf-tap-build`. Ruling: excluded existing SEO prerender plugin because it explicitly reads process environment; all other existing plugins retained. SEO route generation was not validated. Existing chunk-size and ineffective dynamic-import warnings remain.
- Scoped oxlint: zero errors; two existing viewer effect-dependency warnings remain, `/private/tmp/tempori-pdf-tap-final-lint.log`. No generated asset/global lint scope.
- Parent browser verification used an actual two-page PDF parser/viewer/frame and checked touch right/mouse left, out-and-return path, 150% zoom/pen gating, single swipe dispatch and actual ArrowLeft. Responsive widths 320/390 portrait and 844 landscape retained a 44 px dock without document overflow. MusicXML taps stayed on page 1 and its button bar remained. Synthetic PointerEvents were used for gesture paths; native Safari touch/pinch was not verified.
- Focused UI guideline review: labelled native menu buttons, existing focus styles, polite live counter/hint, no input-capturing overlay or layout shift, retained pinch-zoom touch action. No remaining relevant guideline findings.
- No environment variables changed; no actual environment/secret files accessed, no commits or deployment.
