# Tempori view modes execution ledger

Approved scope: all devices expose horizontal/wrapped; phone-only initial horizontal default; explicit browser preference; rotation preserves mode and physical measure; manual exploration suspends horizontal following; separate bounded v2 horizontal annotations; preserve wrapped v1 behavior and library cleanup.

Owner: view_modes_owner (requested gpt-6-astra/xhigh, as confirmed by parent dispatch). Parent handles real browser/performance fixture/config and independent reviewers. No .env/secret access, no npm prebuild, Vite/Vitest env loading disabled before execution.

## Decisions
- Ruling: horizontal following is a separate viewport effect driven by physical measure/layout, leaving the playback clock/metronome loop unchanged — avoids resets on manual scroll — regression tests cover disabled vertical scrolling.
- Ruling: keep existing wrapped annotation schema/geometry; introduce separate horizontal renderer and persistence helpers — prevents implicit v1 migration — shared synchronous flush contract must prevent a failing save from switching modes.
- Ruling: synchronous ID/mode-scoped annotation commits instead of delayed saves — eliminates stale timer writes — pointer rendering must remain bounded and may be frame-batched.
- UI: preserve existing Tempori colors/type/dock; native labeled radio controls for mode, focused viewport keyboard input, inline first-use instructions and resume/failure actions. Existing measure keyboard focus outline needs restoring; horizontal touch-action must allow pinch zoom and both navigation axes.

## Progress
- [x] Read approved plan, existing render/playback/annotation/storage entry points and relevant skills.
- [x] Independent architecture/expanded plan review approved; constraints incorporated.
- [x] Rendering/default preference red-green tests; parent actual OSMD prototype rendered all 8/300 physical measures.
- [x] Viewport coordinates, mode transition/revision, follow/manual input and settings.
- [x] Bounded v2 annotations + flush/erase/undo/failure compatibility.
- [x] Delete cleanup and retry for both namespaces.
- [x] Focused automated checks, independent code review, fixes and re-verification; final reviewer reports no remaining confirmed blocker.
- [x] Parent Chromium component/browser verification complete; native-device performance gate remains unverified (see below).

## Review findings resolved

- Retained the exact wrapped offset builder (including sparse physical index fill/line normalization). Horizontal readiness rejects missing measures instead of estimating a wrapped grid.
- Corrupt/unreadable v2 stays locked and raw bytes are untouched; safe flush permits changing view or going to the library, while retry-load is a separate action.
- Viewport crop recalculates after settings/focus/notice position changes; a regression reproduces the formerly 1-pixel crop when the score moved onscreen without resizing.
- Shift+wheel uses a native nonpassive listener only on the horizontal score; normal vertical wheel and Ctrl+wheel remain native. Parent browser reproduced the original passive-listener issue and confirmed the fix.
- Returning to wrapped restores the current physical measure after matching render and settings close; the pending restoration follows settings/retry revisions and resets per score.
- Explicit current-measure requests work even with automatic follow off. Manual follow suspension persists across automatic loop restarts and pen input is not forcibly interrupted by automatic count-in.
- Browser preference getter access is inside try/catch, covering SecurityError before getItem/setItem.
- Overscan is at most 25% on each side, including score edges; one horizontal backing canvas is used, below the planned two-canvas maximum.
- Failed synchronous saves retain the latest document in separate ID-keyed wrapped/horizontal session maps for SPA unmount recovery. Save/clear success removes the pending snapshot; committed score deletion cleans both caches. Reload/close with unsaved data receives beforeunload protection.

## Verification (implementation owner)

- `frontend/node_modules/.bin/vitest run src/features/tempori src/components/TemporiViewerDock.test.tsx src/pages/TemporiPage.test.tsx` from frontend: **14 files, 60 tests passed**, final source at 19:34 local run time.
- `node --import ./frontend/tests/registerTypeScript.mjs --test frontend/tests/*.node-test.mjs`: **70 tests passed**, including prior focus-dock/wrapper/migration tests and new deletion failure/cleanup-only retry tests.
- `frontend/node_modules/.bin/tsc -b --pretty false` from frontend: **passed**.
- Focused oxlint on changed production TS/TSX: **exit 0**, 4 existing-pattern warnings (toolbar noncomponent exports, library loading effect deps, viewer loading effect deps). No lint errors; no claim of warning-free lint.
- Scoped `git diff --check`: **passed**.
- One earlier parallel focused run showed a count-in resume-mock assertion failure; it did not recur in isolated or final focused runs. No speculative production change was made for it.
- Parent owns full-suite/build and final actual-browser evidence. Reported preliminary browser evidence is separate from owner tests: actual Chromium OSMD 300 measures complete; phone CSS fits; synthetic v2 pointer stroke split across 3 measures; manual pan leaves playback running; crop and Shift+wheel fixes confirmed. Final performance matrix and physical iPhone/Android/iPad/WebKit remain parent verification tasks and must not be claimed from these unit tests.

No environment variables or secret templates changed. No commits, deployment, or real environment file access.

- Final independent reviewer re-read all corrections and reran 7 focused files/44 tests, all passed; no remaining confirmed blocker.
- Parent final verification independently confirmed 14 focused files/60 tests, Node70, tsc and env-disabled Vite production build passing (large-chunk warning). Browser fixture completed 8/100/300-measure renders at 3 emulated viewport sizes, 5 runs each, with complete counts, one horizontal system and end access. This is desktop-host Chromium emulation, not native-device performance certification. Final detailed evidence is maintained by the parent.
- Removed the unnecessary `beginCountInAtSectionStart` dependency from the play/pause callback after final lint review; this does not alter the callback body or production behavior.

## Parent final verification and limits

- Final source: focused Vitest **14 files / 60 tests passed**, Node suite **70 passed**; TypeScript and Vite production build passed. Vite was invoked programmatically with `envDir: false` and a temporary output/cache directory; no npm prebuild/OCR download or real environment files were used. Build retains the >500 kB chunk warning. Focused lint has no errors; existing hook/export warnings remain. Scoped diff whitespace check passed.
- Initial repository-wide Vitest run: **249 passed, 23 failed**. The failures are in 7 unrelated Dieta files with `document/window is not defined` under their Node test environment. Those files/configuration were not changed by this work. The final focused results above are not a claim that the complete repository suite passes.
- Browser method: actual production-bundled Tempori/OsmdViewer/CSS injected into a dedicated Chromium blank page. The full UI fixture replaces only score loading with synthetic MusicXML and storage with an isolated in-memory map. Programmatic pen tests also stub pointer capture and UUID because the blank-page fixture lacks the normal secure-origin context. Native pen gestures, IndexedDB/browser persistence integration, full app routing, and Safari are not claimed from this fixture.
- Direct local server startup failed with EPERM even after escalation; direct Playwright Chrome launch aborted even after escalation. Connected Chrome DevTools enabled the isolated component verification without a local server. No permissions were weakened.
- Synthetic fixture: piano grand staff, repeated section, explicit XML line breaks, and clef changes. Every viewport rendered **8/100/300 physical measures, five runs each**, with correct count, a single system, and accessible final measure. This is warm desktop-host Chromium emulation, not phone/tablet hardware timing or a dense real-score benchmark.

| Emulated viewport / DPR | 8 measures (ms) | 100 measures (ms) | 300 measures (ms) | 300-measure canvas at end |
| --- | --- | --- | --- | --- |
| Desktop 1200×850 / 2 | 27–33 | 97–115 | 302–324 | 3000×374 |
| Phone 390×844 / 3 | 22–32 | 91–108 | 294–310 | 975×374 |
| Tablet 1024×768 / 2 | 27–34 | 96–109 | 300–316 | 2560×374 |

- Maximum fixture SVG width was ~26,059 CSS px. The canvas covers only the viewport crop, remains within the 4 MP / 4096-side limits, and caps effective DPR at 2. The tablet-emulated 10-second programmatic horizontal scroll sampled 1,202 frames with a 9.6 ms p95 interval. Other viewport scroll-frame benchmarks and physical-device thresholds remain unverified.
- Browser behavior checked: desktop defaults to wrapped; phone defaults to horizontal; body width stays within the viewport; explicit choice persists in the fixture store; manual navigation suspends follow without stopping playback; current-measure action resumes; a synthetic cross-bar pen stroke saves as one v2 stroke with three segments; closing settings refreshes an initially 1 px crop; Shift+wheel prevents its native default without a passive-listener error.
- Final source browser regression: select physical measure 100 horizontally, switch to wrapped with settings open, transpose and apply (a newer render revision), then confirm current measure remains 100 and its rectangle is visible (top 333 px in an 850 px viewport), with no error alert.
- **Remaining release gate:** real iPhone/iPad/Android Safari or Chrome touch, pinch zoom, native scrollbar/pen interactions, representative real-score performance, and WebKit checks. No deployment was performed.

## Follow-up: landscape dock and clipped score

- Reproduced the supplied screenshot's layout failure in the actual-component Chromium fixture at 844×390: three stacked dock rows occupied 234 px and collapsing pre-playback controls left the score at y=-189 px. Horizontal follow intentionally never corrected document Y.
- Short landscape viewports now keep a single dock row; a labeled, keyboard-accessible disclosure opens the drawing controls without reserving their height. Portrait/taller layouts retain existing controls. Horizontal playback centers the score in the remaining height and aligns the viewport after playback layout changes/resize, without per-measure vertical scrolling or reacting to ordinary manual vertical scroll. Pinch-zoom scale >1 skips automatic alignment.
- Browser after fix: 844×390 dock 61 px, score y=48…235 above dock y=317; 568×320 count-in and playback both fit, score y=13…200 above dock y=247. No document horizontal overflow. Tool disclosure opens/closes; manual vertical movement remains possible. Portrait390×844 retains the original toolbar and fits the horizontal score above it.
- Two new behavioral regressions were observed failing before implementation and pass afterward. Final focused Vitest: 14 files / 62 tests pass; focus/viewport Node tests:9 pass; TypeScript, environment-disabled Vite production build, changed-component lint and diff whitespace pass. Build retains its existing large-chunk warning. One first parallel run hit the pre-existing mocked render-readiness timing failure; isolated18 and repeated full62 passed without unrelated production/test changes.
- Self-reviewed the scoped diff and UI accessibility/responsiveness. Native iPhone Safari verification remains outstanding; no deployment or environment configuration changes.
