# Tempori score focus mode implementation plan

> **For agentic workers:** Use `executing-plans` inline with one implementation owner. The parent arranges independent plan/code review; no extra implementation delegates, helper scripts, commits, or deployment.

**Goal:** Keep the PBB header hidden continuously only on `/hobbies/tempori/:id`, with a compact persistent `보관함으로` exit and unobstructed bottom controls.

**Architecture:** Match the exact viewer route in AppShell, which owns a persistent dock outside viewer-local Suspense and error boundaries as well as storage loading boundaries. Existing playback, annotation, and beat controls render into dock slots through a small context/portal wrapper so ordinary flex layout prevents overlap. White score surfaces extend to the page edges without changing the saved application theme. Scroll anchors use the visible score area above the dock and invalidate cached anchors when viewport geometry changes.

**Tech stack:** Existing React, React Router, CSS, TypeScript; Node built-in regression tests.

**Spec:** User-approved focus behavior relayed in the current task: continuously hidden global header, compact persistent exit, safe areas, paper surroundings, no scroll-triggered header or Fullscreen API.

## Global constraints

- No ignored paths, dependencies, real environment/secrets, blocked docs, installs, copies, build servers, commits, or deployment.
- Preserve landing/library/global headers, prior migration/rebrand and measure-wrapper behavior.
- Existing design tokens and Pretendard typography; score paper `#fff`, ink `#000`, muted `#666`, border `#e6e6e6`, accent `#6366f1` where already used.
- Shell exit exists during lazy/storage loading and errors; use semantic Link, visible keyboard focus, minimum 44px touch target.
- Use safe-area top/left/right/bottom insets; controls wrap without collisions at 320px, tablet portrait/landscape, and enlarged text.
- Node-only tests are permitted. React rendering, bundling and native iPad Safari validation remain unavailable under current dependency restrictions; parent investigates browser-only possibilities.

## Review focus

1. Exact viewer matching excludes landing/library, unknown deeper paths and other apps, supports trailing slash.
2. Exiting viewer restores the surrounding background and browser theme hint without changing saved theme.
3. Loading/storage/render errors retain shell exit and never require successful score loading.
4. Count-in, annotation brush controls, long measure counters and enlarged text stay in normal dock layout.
5. Viewport height/offset and dock changes invalidate anchor cache; page scrolling uses the available score area, with no residual header subtraction.

## Task 1: Shell focus mode and persistent dock

Files: `frontend/src/components/AppShell.tsx`, new `frontend/src/components/TemporiViewerDock.tsx` and `.test.tsx`, existing `AppErrorBoundary.tsx` (reuse), new `frontend/src/features/tempori/utils/focusMode.ts`, `frontend/src/pages/TemporiPage.tsx`, `frontend/src/index.css`, new `frontend/tests/temporiFocusMode.node-test.mjs`.

- [x] Add failing tests for exact route matching and reversible document score-surface/theme-color lifecycle using browser-boundary fixtures.
- [x] Implement `isTemporiViewerPath(pathname: string): boolean` and a reversible `applyTemporiScoreSurface(document)` helper; shell renders flush score wrapper and omits global header for exact score paths only.
- [x] Author React behavior tests for pending lazy score, rejected lazy score, thrown renderer, and exit navigation; these cannot execute while ignored React test dependencies are forbidden. Add viewer-local Suspense and existing AppErrorBoundary inside shell dock provider, ensuring outer App Suspense/ErrorBoundary never replace the shell for child failures. Persistent Link and three layout slots (annotation, beat, playback) stay outside both inner boundaries. Reserve observed dock height through a CSS custom property; remove on unmount.
- [x] Remove duplicate page back link; group page heading metadata in a compact normal-flow header that scrolls away naturally and does not introduce a new playback layout shift.
- [x] Apply scoped white background/light paper tokens, edge/safe-area padding, focus states and bottom content clearance. Dock controls get explicit white surfaces/dark ink rather than accidentally inheriting paper ink over existing dark surfaces. Cleanup restores only owned root/meta values still matching its override, preserving newer external changes. Keep Safari native UI unchanged.
- [x] Run focused Node tests; inspect actual diff and loading/error control paths.

## Task 2: Dock integration and scroll geometry

Files: `FloatingPlaybackButton.tsx`, `TemporiAnnotationToolbar.tsx`, `MetronomeBeatIndicator.tsx`, `scrollAnchor.ts`, new `scoreViewport.ts`, `TemporiAutoScroller.tsx`, CSS and Node test file above.

- [x] Add failing tests for anchored scroll targets with dock reservation, native visual viewport offsets, page scroll height, resize and anchor-ratio changes.
- [x] Render existing floating controls through reusable dock slot wrapper, with fallback to current rendering outside score shell. Use scoped static positioning, wrapping and bounded widths in dock slots; no duplicate fixed control regions.
- [x] Add `getScoreViewport()` returning visible top/height from visualViewport plus dock geometry; use the same viewport for anchor/page mode. Cache anchors by viewport geometry and ratio rather than indefinitely across resize.
- [x] Keep measure offsets document-relative; do not subtract the removed header or alter timing/rendering/storage algorithms.
- [x] Run new tests and all existing `frontend/tests/*.node-test.mjs`, guideline recheck, diff whitespace check and independent code review. Apply validated significant findings, re-run affected tests.

## Verification and execution record

- Baseline inspection: git root and applicable tracked ignore rules read; no permission-sync warnings reported. New plan/test/helper paths are not ignored. Core excludesfile unset.
- Initial UI review: current fixed bottom controls can collide with a new exit; existing immersive header selector refers to an absent wrapper. New dock and explicit page heading wrapper address these within scope.
- No browser/build/type/lint claims without execution. Parent will communicate native Safari limitations.
- Plan review accepted with viewer-local Suspense/error boundaries; exit remains outside both. Parent approved a visible 44px scroll-to-top dock button in place of the existing invisible top-center hit area, which would intercept score taps after removing global navigation. Generic unused component remains untouched.
- Ruling: retain score title in normal flow during playback rather than activate the old nonmatching immersive heading selector. This avoids a new absolute score-offset shift and keeps this change scoped to global header focus mode.
- Initial RED: new helper import missing as expected. Second focused RED isolated anchor behavior (600 instead of 640; page target 1000 instead of 980). After geometry integration, focused Node suite passed 8/8. React boundary/portal tests are authored but not executed due forbidden dependency access.

- Independent review fixes: explicitly rebind paper scope aliases (inherited root aliases had resolved to dark theme), move annotation brush range to its own constrained grid row, and preserve a newer app light-theme selection during cleanup. New theme regression was RED then GREEN.
- Final implementation-owner verification after source fixes: all 6 allowed Node suites passed 53/53; scoped git diff --check exited 0. Static guideline recheck covered semantic navigation, focus, minimum touch size, contrast, safe areas and control wrapping. React tests, browser layout/native Safari, build, TypeScript and lint remain unexecuted under dependency restrictions. Final independent reviewer confirmed the fixes and reported no remaining important findings.
