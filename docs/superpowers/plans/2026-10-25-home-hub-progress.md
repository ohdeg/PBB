# Implementation ledger — 2026-10-25-home-hub-redesign.md

- User authorized implementation in the current chat. One implementation owner; independent plan/code review.
- Existing .gitignore modification is user work and is not edited.
- Pre-flight: catalog visibility feeds both cards and recent shortcuts; tracker writes IDs consumed by RecentApps. Shared interfaces checked.
- Ruling: use Node's native TypeScript stripping and node:test for storage/path behavior, without loading any ignored dependencies. React tests will be written but not run through denied node_modules. This is permitted focused validation, not a claim that the full suite/build passed.
- Ruling (plan review correction): track explicit usagePaths matching registered App.tsx execution routes, including direct deep links. Match complete segment patterns and exclude landings. Metadata must be kept in sync with route additions; tests cover sibling routes and invalid prefixes.
- Design: existing Pretendard, white/charcoal canvas, cream #f4ecd6, peach #f3c9b6, lilac #c5b0f4, mint #c8e6cd, navy #1f1d3d. Left-aligned short intro, two recent shortcuts, equal app grid. Pastel media panels distinguish actual apps; no invented dashboard imagery or new animation.
- Plan review: requested from gpt-6-astra, high (explicit spawn configuration). Parent model/effort unverified.
- Task 1: test-first storage, permission filtering, and route matching tests prepared.

- Plan review: gpt-6-astra/high identified deep-link coverage, image-error fallback, and header test coverage; incorporated all three.
- Task 1: native Node tests observed 7 assertion failures with empty implementations, then 11/11 passed with storage and route matching implemented.
- Tasks 2/3: home cards, scoped styles, recent shortcuts, home header, tracker, React tests and e2e scenarios implemented. React/Vitest and full build remain unrun due to denied dependencies.

- Final review: gpt-6-astra/high reviewed actual tracked and untracked code; image test's selector scope (P2) and case-insensitive route matching (P3) identified. Both fixed; React selector fix inspected, runtime unverified. Path regression observed fail then all 12 native tests passed.
- CSS review: home-specific padding override prevents late shared mobile app-shell padding from squeezing the new layout. Other apps' shared padding is unchanged.
- Browser verification: static fixture did not load. file navigation disabled, HTTP listen EPERM persisted after escalation, sourcePath rejected as outside tool workspace even for the project. No success claims for UI screenshots, responsiveness, or React integration. Repository fixture removed.
- Guideline review: heading hierarchy, named links, 44px targets, focus, theme colors, image sizing/fallback, and home-only selectors inspected. Actual visual contrast/behavior is still unverified.
- Final state: implementation and independent review done; full runtime/build/browser validation remains blocked by stated access/tool restrictions. No environment variables changed; no commit/publish.

- Follow-up: diagnosed live localhost blank page caused by RecentApps.tsx/recentApps.ts case-insensitive extension resolution. Renamed utility to homeRecentStorage.ts and component to RecentAppsSection.tsx (also avoids stale resolver cache). Browser reload now shows all 3 public apps; 390px viewport has no horizontal overflow. Only observed console resource error is unauthenticated POST auth/refresh 401. Native tests 12/12 passed.

- Header follow-up: reproduced desktop navigation collapsed to 377px centered at 1440px viewport. Legacy .home-nav display:flex was shrinking the inner grid. Renamed the new header modifier to global-nav--home, preserving legacy selectors. Verified actual browser: inner width 1280px, logo x=104px, actions right=1336px aligned with body; 390px viewport has no horizontal overflow and drawer sits beneath header.
