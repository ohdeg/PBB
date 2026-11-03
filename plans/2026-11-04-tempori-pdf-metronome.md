# PDF metronome settings implementation plan

**Goal:** Let PDF practice users choose tempo, meter, and each beat's strong/medium/weak/silent accent, with per-score local and account persistence.

**Architecture:** Extend the existing practice document with optional `pdfMetronome: { beatsPerMeasure, beatType, beatStrengths }`; root `bpm` remains quarter-note BPM. Keep state generation/conflict/session logic and schema version 1 unchanged. A focused PDF settings section reuses beat-strength visuals without exposing unsupported subdivisions. Retain the compact dock, adding a small tempo settings shortcut only if it fits.

**Tech stack:** React 19, TypeScript, Vitest/jsdom, existing WebAudio utility, Java state validator/JUnit.

**Spec:** Current user PDF meter/accent request and existing approved compact PDF page-tap navigation.

## Constraints and acceptance criteria

- Never read/create/change/source actual environment or secret files or inspect process environment. Build/test configuration explicitly disables env file loading.
- Preserve existing uncommitted page-turn changes; no deployment, commits, worktrees, dependencies, or authentication/CAS changes.
- Meter numerator integer 1..16; denominator 1,2,4,8,16. BPM 20..300 quarter notes per minute; click interval `60000 / bpm * 4 / beatType`.
- Optional new object accepts exact-length `strong|medium|weak|silent` vector. Missing object restores 4/4 with first strong and remaining medium, preserving previous PDF playback sound.
- Growing numerator preserves current accents and appends medium; denominator changes do not discard accents. All settings update live and changes restart the measure deterministically.
- Saving spreads the loaded practice document and changes only BPM/new PDF settings. Restore never auto-starts; remote updates defer while playing/annotating.
- Disable writes until loaded/eligible seeded base is established; update full applied/saved base ref only after successful synchronous save.
- Menu labels/controls accessible, input focus visible, accent grid wraps at mobile widths, hidden settings never cause PDF page taps. Compact dock fits 320px.

## Files/interfaces

- New `utils/pdfMetronome.ts` plus focused tests: settings defaults/read/resize, beat interval/index/strength helpers.
- `Tempori.tsx`: retain applied/saved base when persisting known MusicXML fields, preserving additive fields.
- `services/temporiStateRepository.ts`: optional `PracticeState.pdfMetronome` and matching validation. Extend state sync tests for payload roundtrip.
- Java `TemporiStateService.java` and test: validate only the optional additive object; retain generic JSON storage/schema.
- `pages/PdfTempori.tsx` and test: apply settings, persist complete payload, scheduler and controls.
- `components/BeatStrengthBarGrid.tsx`: optional subdivisions visibility defaults true; PDF hides unsupported subdivision picker.
- `components/TemporiViewerDock.tsx`: focused menu opening hook if needed for compact tempo shortcut. Preserve all current targets and menu focus behavior.
- `src/index.css`: append scoped PDF control layout only; preserve page navigation edits.

## Review focus

Old practice payloads; denominator timing and silent beat progression; immediate consecutive writes without losing prior fields; remote restore during playing/stop; 16 beats/320px menu and page taps.

## Steps and ledger

- [x] Plan/contract review by independent architecture reviewer before production edits.
- [x] RED: utility default/meter/tempo/modulo/silent cases; frontend/backend invalid optional-object cases. Run focused tests and confirm expected failures.
- [x] GREEN: implement helper/type/validators; run focused tests. Add sync roundtrip against existing real repository/sync with external boundaries mocked.
- [x] RED: PDF component live settings/persist/restoration/no-autostart/tempo menu cases using real dock and settings, external audio/render only mocked.
- [x] GREEN: implement PDF menu and metronome, preserve current behavior and compact controls; run focused tests.
- [x] Independent actual diff/code review, validate and fix significant findings, recheck guidelines.
- [x] Final verification: scoped lint; full jsdom Vitest suite; TypeScript; env-disabled core build; Java focused JUnit if available; root browser mobile/desktop interaction review.

## Execution ledger

2026-11-04: Read repository/skills; inspected current fixed 4-beat PDF player, generic JSON practice storage and front/back validators. Existing page navigation uncommitted work preserved. No real environment files read. Contract sent for review before implementation. Skills applied: writing-plans, executing-plans, test-driven-development, web-design-guidelines then frontend-design; user-authorized workflow overrides missing helper scripts/mandatory commits.

2026-11-04: Independent Astra architecture review approved optional nested contract. RED frontend validation rejected none of nine malformed settings; missing PDF helper caused expected import failure. Java RED running.

2026-11-04: Helper/frontend validation RED→GREEN 12/12; Java malformed-null validation RED→GREEN then boundary coverage 25/25; PDF+MusicXML persistence integration RED→GREEN. Root browser found shortcut focused earlier page-fit action; preceding-action regression RED→GREEN with designated input focus and nearest scrolling. Reviewer found focused stale BPM draft could replace remote; focus/blur deferral and normalized no-op guard RED→GREEN. That guard exposed old committed generation reverting optimistic edit; monotonic apply fixed and typed6→60 remains correct.

2026-11-04: Reviewer identified queued asynchronous persistence failure can leave optimistic generations above explicit conflict resolution. Regression optimistic8→conflict6→chosen7 RED→GREEN; viewer observes conflict clearing and applies chosen payload/expected generation once without changing repository/CAS semantics. Ruling: ordinary cache reloads apply only newer generations, but an observed conflict resolution is authoritative even below optimistic generation — preserves chosen content while preventing stale-cache rollback; wrongness would show as stale display after storage recovery.

2026-11-04: Browser evidence from root: real IndexedDB 90BPM 3/8 [strong,silent,medium] restores after remount with playback off; 320px and844px shortcut focuses visible BPM, all dock controls44px with zero horizontal overflow;16beat grid wraps and scrolls; keyboard metronome start/stop progresses without PDF page turns. Live cloud and native Safari not exercised.

2026-11-04: Core env-disabled production build passed using configFile:false/envDir:false React+Tailwind, output /private/tmp/tempori-pdf-core-build (SEO prerender omitted to avoid process-env reads). Default node-environment Vitest run exposed23 unrelated Dieta document/window undefined failures in7 files; full jsdom run passed436/436. Final rerun after last reviewer fix pending. No environment variable names added/changed/removed.

2026-11-04 final verification: independent reviewer accepted current actual code and independently ran 60/60 focused tests. After final fixes, full `vitest run --environment jsdom` passed 437/437 tests in85files (/private/tmp/tempori-pdf-final-jsdom.log), `tsc -b` exited0, core env-disabled build exited0 (/private/tmp/tempori-pdf-core-build.log), scoped oxlint exited0 with5warnings (existing hookdeps/FastRefresh patterns; one new same-pattern hookexport warning), scoped `git diff --check` passed. Java25/25 remains valid after frontend-only final fixes. Fresh web guidelines reread; scoped controls have accessible labels, keyboard focus/Enter handling,44px targets and wrapping; root verified actual layout. No unresolved significant review findings, no deployment/commits, no secrets accessed.
