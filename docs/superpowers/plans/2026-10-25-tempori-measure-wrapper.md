# Tempori measure wrapper implementation plan

> Use `executing-plans` directly, without the unavailable companion helpers. One implementation owner; independent plan and code review are coordinated by the parent task. No commit or publication.

**Goal:** Keep the current-measure wrapper over the musical content of the full piano grand-staff measure when an inline or trailing clef appears.

**Architecture:** Fix the shared content-start calculation in `measureTiming.ts`. A visible note/rest across every staff of the measure is authoritative evidence that content has already begun; later clef, key, time or repeat glyphs must not advance the start beyond that first content. When no note/rest can be measured, keep the layout's left boundary rather than guess which header is leading. Use same-ID staff groups within the original selected horizontal cluster for stave bounds and preserve neighbor snapping.

**Tech stack:** TypeScript geometry functions, Node's built-in test runner and TypeScript stripping; existing React/OSMD renderer unchanged.

**Spec:** User's supplied iPhone Safari screenshot and request: stopped at measure 12/300, the purple wrapper collapses around the end clef of the first measure on the row. Existing opening-header exclusion, score layout, selection, playback, storage and migration behavior must remain compatible.

## Evidence and constraints

- `getContentStartAfterHeaders` currently takes the maximum of all header right edges before considering the earliest note. Both highlight and playhead clamp that incorrect result to 85% of the measure width, explaining the narrow trailing rectangle.
- [OSMD 1.9.9 VexFlowMeasure](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/1.9.9/src/MusicalScore/Graphical/VexFlow/VexFlowMeasure.ts#L306) adds end clefs to the stave; its `draw` method places the stave and voices in the same `vf-measure` group. The broad header query therefore includes end clefs.
- That renderer sets each group ID from `this.MeasureNumber`; [GraphicalMeasure](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/1.9.9/src/MusicalScore/Graphical/GraphicalMeasure.ts) represents one staff's measure and derives that number from the shared source measure. Duplicate IDs across treble/bass staves are therefore an upstream-supported shape.
- The resolver already merges those group rectangles, but its refinements use only the first matching element, losing the other staff's content and vertical extent. A baseline duplicate-staff fixture reproduced height 40 instead of the expected grand-staff height 120 before production edits.
- Read only nonignored source. Do not access actual environment/secret files, ignored dependencies or build outputs, install/copy dependencies, or start a process that consumes ignored files. The project-root `.env.example` exception is unnecessary here.
- No CSS or visual redesign: preserve the existing purple/teal wrappers, grand-staff height, overlay interaction and accessibility behavior.
- Native iPhone Safari, React/browser integration, lint/typecheck and full build require inaccessible dependencies or the user's device and are not claimed by the Node geometry tests.

## Review focus / acceptance criteria

- A first-on-line measure with leading rest and trailing clef starts at the rest, retains its full grand-staff height and ends at its own barline.
- Mid-measure clefs and other late header-class glyphs cannot exclude earlier musical content.
- Ordinary opening clef/key/time/repeat glyphs retain existing content-start behavior; measures without measurable content keep the full layout boundary instead of collapsing around an unclassified header.
- Ordinary non-first measures and adjacent highlight boundaries remain unchanged, with no overlap.
- Fractional/mobile-scaled rectangles and container offsets produce proportionately correct geometry.

## Task 1: Correct line-start content geometry

**Files:**
- Modify: `frontend/src/features/tempori/utils/measureTiming.ts` (shared content-start helper, matching measure-group lookup and refinement consumers, now-unused header selector constant).
- Add: `frontend/tests/temporiMeasureLayout.node-test.mjs`.

**Interfaces:** Call the existing `resolveMeasureLayoutsInContainer`, `getMeasureHighlightBounds`, `createPlayheadHighlightLookup` and `computePlayheadHighlight` with minimal DOM-shaped rectangle fixtures. No public API change.

- [x] Add regressions with leading rest, note, mid-measure/trailing header, separate treble/bass measure groups in both DOM orders with earlier bass content, neighboring measures, scaled rectangles and no-content fallback. Expectations use literal hand-derived geometry.
- [x] Run `node --import ./tests/registerTypeScript.mjs --test ./tests/temporiMeasureLayout.node-test.mjs` from `frontend`; confirm the relevant new case fails because the current wrapper starts near the trailing clef.
- [x] Make the earliest valid note/rest across matching groups authoritative, bounded by layout left. If no note/rest rectangle is available, return the layout left; remove unused header selectors. Read stave bounds from all matching groups to retain the full grand staff.
- [x] Run the focused test and permitted existing `tests/*.node-test.mjs` suite; expect zero failures. Inspect scoped diff and perform the guideline recheck on unchanged highlight rendering.
- [x] Independent code review, fix significant findings, re-run affected checks. Record results below.

## Execution record

- Initial relevant-file status clean. Ignore rules checked; plan/test paths are nonignored. No environment variables changed.
- Pre-flight: one task; no new shared interface.
- UI before-review: highlight is decorative (`aria-hidden`), noninteractive (`pointer-events: none`), and positioned from geometry after layout; no new styling/accessibility issue in the affected path.
- Design decision: no-content measures use their full layout boundary. Without content ordering, glyph classes do not distinguish leading from trailing clefs; retaining headers is safer than excluding an unknown amount of the measure.
- Independent plan review approved, with regression-backed clarification to include all same-ID staves and preserve their full height regardless of DOM order.
- RED: single-staff control passed; 11 regressions failed. Trailing clef gave left 210 / width 30 instead of left 80 / width 160; duplicate-staff height was 40 instead of 120; earlier bass content and reversed DOM order also failed independently.
- GREEN: focused geometry suite 12/12; permitted Node suite 42/42, including existing storage migration, compatibility and practice-state tests. Scoped `git diff --check` passed. This is not a Vitest/browser/build result.
- UI guideline recheck: unchanged `TemporiPositionHighlight.tsx` and wrapper CSS retain decorative semantics, pointer behavior and established styling. Geometry is read by the existing post-layout snapshot pipeline; no new render-phase DOM reads.
- Parent independently re-ran the initial focused 12/12 and full 42/42 suites and scoped diff check successfully.
- Code review found that gathering all same-ID groups bypassed the existing selected horizontal cluster: a distant duplicate expanded the wrapper from width 160 to 960 and pushed neighbors outside the score. Added a failing regression, then reused the original raw-cluster selection when collecting staff groups. A nearby disconnected-part control preserves the existing cluster behavior even after width clamping.
- After the review fix, the permitted Node suite passed 44/44 (14 geometry tests plus 30 existing tests); scoped diff check passed. No review findings have been declined or deferred.
- Final re-verification: the parent and independent reviewer each re-ran all 44 Node tests and scoped diff checks successfully. The reviewer inspected the cluster-membership correction and approved it with no remaining important findings.
- Completion scope: geometry implementation and review complete. Native iPhone Safari, real OSMD/React browser rendering, Vitest, lint, typecheck and build remain unverified because the allowed local workflow cannot consume the ignored dependencies or actual device data. No environment variable, commit or deployment change.
