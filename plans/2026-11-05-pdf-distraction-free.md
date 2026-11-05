# PDF distraction-free viewer implementation plan

**Goal:** Show the whole PDF inside the usable viewport, with controls revealed by deliberate action and no persistent navigation row.

**Architecture:** The shared viewer frame owns presentation visibility while retaining mounted dock portal targets. PDF pages register presentation mode; MusicXML retains its existing dock. Existing guarded pointer input separates outer-third page turns from a center-third control toggle.

**Constraints:** Preserve annotations, metronome playback and existing score work. Never read actual environment or secret files. No dependencies, commits, deployment or permission changes.

**Design:** Keep existing paper white, neutral viewport and controls. PDF paper uses available width/height without the current internal gutter; preserve aspect ratio, safe areas and zoom/pan. Controls overlay paper and never change its fitted size. Camera stop remains independently visible. Ink, native pinch zoom, loading and errors expose controls for recovery. Application zoom permits guarded center taps while preserving native keyboard scrolling. A focus-visible reveal button and C/Escape support keyboard and assistive navigation.

**Files:** `TemporiViewerDock.tsx` presentation/focus/state, `ScorePageViewer.tsx` PDF registration/fit/hint, `usePageTurnInput.ts` tap zones, `scoreViewport.ts` optional dock reservation/safe bottom, `index.css` PDF fit and hidden/focus controls. Focused tests beside existing modules.

## Acceptance and review focus

- [x] Default PDF row/menu hidden; center tap toggles; outer thirds turn; swipes and guarded input remain correct.
- [x] Visible controls do not change PDF fit or remount portal content; metronome and annotations survive toggling.
- [x] Keyboard/AT can reveal, hide and exit; camera stop remains reachable.
- [x] Ink, zoom and loading/error recovery cannot strand users with hidden tools.
- [x] Full PDF fits without cropping or distorted annotation coordinates; MusicXML remains unchanged.

## Execution

- [x] Add focused failing behavior tests and observe expected failure.
- [x] Implement the integrated presentation change sequentially.
- [x] Run focused jsdom tests, type/lint checks, and build with `envDir: false`.
- [x] Independent review actual diff, address validated findings and re-run affected checks.
- [x] Browser verification in desktop and mobile viewports (root agent).

Plan review: shared presentation state avoids score remounts; separate urgent status prevents hidden camera stop; keeping controls visible during gesture-disabled modes prevents recovery traps. No migration or environment changes.

Validation: 86 jsdom test files / 443 tests passed, TypeScript build passed, scoped lint had zero errors and five warnings (mixed component/hook exports and existing effect dependencies), scoped diff whitespace check passed. Production client build used `configFile: false`, `envDir: false`, React/Tailwind plugins and `/private/tmp/tempori-pdf-chrome-production`; existing chunk-size/dynamic-import warnings remain. Independent reviewer validated and resolved focus-after-reveal, Escape-from-viewport, recovery-menu persistence, resolved safe-bottom and zoom keyboard-scroll findings; final re-review reported no outstanding findings.

Root browser checks: portrait 390×844, landscape 844×390, simulated top20/bottom24 safe insets, stable fit while revealing controls, application zoom center toggles, keyboard exit focus/Escape/C, continued metronome and annotation recovery. Native Safari remains unverified.
