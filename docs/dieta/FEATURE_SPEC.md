# Dieta — Feature Spec (product contract)

> Source of truth for live FE + Spring BE + MySQL + Redis + Gemini.
> Do not invent product rules beyond this doc, Notion Dieta page, and FE types/`dietaMath`.  
> Status: **Phase 0** (this doc) · **Phase 1** BE profile/body/activity/keto live · **Phase 2** weekly check-in live · **Phase 3** Redis meal queue + Gemini finalize live · **Phase 4** FE wired to `/api/v1/dieta/**` (auth Bearer via `apiClient`; guest landing client-only) · **Phase 5** homemade recipe → Gemini → recipe library; explicit add-to-day → intake merge · **Phase 5b** finalize sends `knownRecipes` from DB.

## 1. Product

**Dieta** (Esperanto · diet). Weight-and-rhythm weekly coaching notebook — not a full AI health suite.

- **Body metric (MVP): weight-only (kg).** Body-fat / skeletal-muscle columns are reserved and unused in coaching math.
- Daily kcal target · macros (after meal finalize) · meal queue · activity logs · weekly check-in.
- Fasted weight: optional daily on home (charts only); check-in day weight drives coaching X.
- Weekly eval uses **single compare**: last check-in (else onboarding) weight vs this check-in weight.
- LOSS/GAIN **target weight** reach → auto **MAINTAIN**. Settings: **maintain-mode toggle only** (no LOSS↔GAIN switch).

Hobby id: `dieta`. Routes under `/hobbies/dieta/**`. API: `/api/v1/dieta/**`.

## 2. Goal modes

| Mode | Daily kcal | Weekly W | Derived |
|------|------------|----------|---------|
| LOSS | TDEE − initial deficit (≥ BMR) | user W | effective target = `W × 0.9` (internal; stored as `weeklyBodyFatLossKg`) |
| GAIN | TDEE + initial surplus (≤ TDEE+δ) | user W | effective = `W × 0.9` (`weeklyMuscleGainKg`) |
| MAINTAIN | **= TDEE** | 0 | no X; onboarding asks activity factor only |

Safety: TDEE ≥ BMR · LOSS daily ≥ BMR · GAIN daily ≤ TDEE + `gainCeilingDeltaKcal`.

BMR: Mifflin–St Jeor; user-entered or estimated from weight/height/age/sex.

### Conservative TDEE activity factor

UI stores the survey `activityFactor` as chosen (e.g. 1.2 / 1.4 / 1.55 / 1.725).  
TDEE uses a **conservative** factor so maintain kcal is not overstated:

```
tdeeFactor = max(1.2, 1.0 + (activityFactor − 1.0) × 0.75)
TDEE = max(round(BMR × tdeeFactor), BMR)
```

Applied in FE `dietaMath.computeTdee` and BE `DietaMath.computeTdee` (onboarding and any path that multiplies BMR × activity). Check-in TDEE re-estimate from intake/weight does **not** use this (no activityFactor multiply).

## 3. Weekly X & bands (weight-only)

- **X** (LOSS/GAIN): `weightDeltaKg` signed by goal direction, then **`÷ 1.2`**.  
  - LOSS: `X = (−Δweight) / 1.2`  
  - GAIN: `X = (+Δweight) / 1.2`  
- Fat/muscle deltas are **not** used for X in MVP (weight-only).
- MAINTAIN: no X; next daily = estimated TDEE.
- Bands vs W: `X < 0.75W` → PLATEAU · `X > 1.25W` → TOO_FAST · else ON_TRACK.
- TDEE re-estimate: `avgIntake + (−(Δweight/1.2)×7700)/7`, floor BMR. If no intake days, use current daily for estimate input; prefer HOLD when X missing.

### Check-in apply · `keepTargets`

Modal choices after proposal:

| Choice | `keepTargets` | Effect |
|--------|---------------|--------|
| 유지 | `true` | Keep `dailyKcal`, `weeklyTargetKg`, `weekActivityExtraKcal` (and derived weekly fat/muscle). Apply TDEE / `weekStartsOn` (and MAINTAIN auto fields) from patch only. Ignore weight-based X prescription for those targets. |
| 체중 기준 조정 | `false` | Apply proposed `dailyKcal` · TDEE · `weekActivityExtraKcal` · `weekStartsOn` as usual. |

Persisted on `DietaCheckInLog` / `dieta_check_in_logs`.

### Target weight → MAINTAIN

- LOSS: weight ≤ `targetWeightKg` → MAINTAIN (daily=TDEE, W=0, activity extra 0).
- GAIN: weight ≥ `targetWeightKg` → same.
- Checked on home weight save and check-in confirm.
- Not locked: Settings maintain toggle can leave MAINTAIN.

### Maintain-mode toggle (Settings)

- **ON** → enter MAINTAIN; remember prior LOSS/GAIN in `lastNonMaintainGoalType`; keep `targetWeightKg`.
- **OFF** → restore `lastNonMaintainGoalType`; re-apply initial deficit/surplus helpers; W = existing or default `0.5` if 0.

## 4. Onboarding (4 steps)

1. Basics: height, **weight**, age, sex, optional BMR.
2. Goal: LOSS/GAIN/MAINTAIN · (L/G) target weight + W + activity factor · MAINTAIN: activity factor only.
3. Diet style: BALANCED / TRAINING / KETO / VEGAN + optional macro customize (±10%p).
4. Personal daily target preview + optional advanced step kcal knobs (LOSS/GAIN) + **`geminiMealConsent`**. Preview uses existing BMR/TDEE and goal-bound helpers; each step validates numeric input before continuing.

On complete: `onboardingComplete=true`, `weekStartsOn=today`, `weekActivityExtraKcal=0`, body log `source=ONBOARDING`, `dietBaselineMethod=SURVEY`, `lastNonMaintainGoalType` = GAIN if goal GAIN else LOSS.

## 5. Screens / UX (summary)

- Landing (auth optional; skip to home if onboarded).
- Home: daily macros preview, weight chart, optional fasted weight, check-in CTA, keto modal.
- Meals: daytime queue by mealType; finalize → Gemini → intake log. Homemade recipe via 「등록 음식」→「추가하기」 → immediate Gemini → `dieta_recipes` library only (no intake and no Redis queue); same modal select → copy recipe to today (`add-to-day`); finalize passes `knownRecipes`.
- Activity: steps / minutes / activity kcal (known fields only); week extra kcal hint.
- Check-in: 7-day gate (`today − weekStartsOn ≥ 7`); weight; proposal modal with keepTargets.
- Settings: maintain toggle, targets, step kcal, Gemini consent, **온보딩 다시** (confirm → `POST /reset` wipe → onboarding).

Nav: 홈 · 식사 · 활동 · 설정 (no progress tab; `/progress` → home).

## 6. Gemini meal finalize contract

Request `schemaVersion: 1`, `locale: 'ko-KR'`:

- `goalHint`: `{ goalType, maintainKcal (TDEE), dailyKcalTarget, targetWeightKg? }`
- `meals`: `[{ mealType, items: string[] }]` — **Redis queue one-line items only** (never include homemade recipe text)
- `knownRecipes`: `[{ name, kcal, carbG, proteinG, fatG }]` — day's LEGACY/INTAKE rows from `dieta_recipes` (exclude LIBRARY) (pre-analyzed; do not re-estimate into `totals`)
- `activityHint`:
  - **`steps` / `activeMinutes` always present** (use `0` if unknown).
  - **`activityKcal` only if the user entered burned kcal** — omit when null/absent (never fake `0`).
- `instructions`:
  - `needMacros` / `needKcal` / `needOneLineReview`: true
  - `missingAmountAsOneServing`: true
  - `includeActivityInReview`: true
  - **`estimateActivityKcalIfMissing`: true** — when `activityKcal` absent, model estimates from steps/activeMinutes for the review tone only.

Response: `totals { carbG, proteinG, fatG, kcal }` + `oneLineReview`.  
`totals` = **queue items only**. Persist to `dieta_intake_logs` with daily row totals = `sum(dieta_recipes for loggedOn) + queueTotals` (no double-count). Requires `geminiMealConsent`.

Example finalize request fragment:

```json
{
  "schemaVersion": 1,
  "locale": "ko-KR",
  "loggedOn": "2026-07-30",
  "meals": [{ "mealType": "LUNCH", "items": ["현미밥 한 공기"] }],
  "knownRecipes": [
    { "name": "된장찌개", "kcal": 270, "carbG": 20.0, "proteinG": 25.0, "fatG": 10.0 }
  ],
  "activityHint": { "steps": 5000, "activeMinutes": 30 },
  "instructions": { "needMacros": true, "needKcal": true, "needOneLineReview": true, "missingAmountAsOneServing": true, "includeActivityInReview": true, "estimateActivityKcalIfMissing": true }
}
```

### 6b. Homemade recipe (immediate analyze)

- UI: Meals 「등록 음식」→「추가하기」 → title + ingredient lines (amounts) + **몇 인분 (servings)** + optional short steps. **No mealType on create.**
- Gemini returns **per 1 serving (1인분당)** kcal + macros (batch size = `servings`). Persist those per-serving values on `dieta_recipes` plus `servings`.
- `meal_type` is **nullable** on create (library/source row). Meal type is chosen only when **adding to today** from the library modal.
- **Does not** enter Redis daytime queue. Calls Gemini immediately (same schemaVersion 1; activity omitted / review activity flags off; `perServingOnly: true` + `servings`; `missingAmountAsOneServing` still true; `knownRecipes` empty on this call).
- Inserts a **LIBRARY** row into `dieta_recipes`; `logged_on` is the registration date. Macros/kcal columns = **per serving**. Registration does not count as eating.
- Only `add-to-day` creates an **INTAKE** row and upserts `dieta_intake_logs`. Totals = day LEGACY/INTAKE rows + preserved legacy JSON-only recipes + optional queueTotals. LIBRARY rows never contribute. Registration returns `intake: null`.
- Day finalize loads DB recipes → sends `knownRecipes` to Gemini; analyzes **only Redis queue text items** into `queueTotals`; writes `recipeIds` + `knownRecipes` audit snapshot; merges macros (no double-count).
- Requires `geminiMealConsent`. Missing Gemini key → 503; transport, parsing, or invalid nutrition response → 502. No production stub or fabricated nutrition is persisted. Tests inject controlled analysis responses.
- **UX (meals header):** top-right 「등록 음식」→ **modal** (list all user recipes, newest first) with in-modal 「추가하기」(create + Gemini, servings). Select → **mealType** → 「오늘 섭취에 더하기」 via `POST /recipes/{id}/add-to-day` (copy **1인분** macros, no Gemini). `/hobbies/dieta/recipes` redirects to `/meals`.

`source_meals_json` shape:

```json
{
  "goalHint": {},
  "meals": [],
  "activityHint": {},
  "queueTotals": { "carbG": 0, "proteinG": 0, "fatG": 0, "kcal": 0 },
  "recipeIds": ["uuid-…"],
  "knownRecipes": [
    { "name": "된장찌개", "kcal": 270, "carbG": 20.0, "proteinG": 25.0, "fatG": 10.0 }
  ]
}
```

Legacy `analyzedRecipes[]` (pre–`dieta_recipes` table) may still be read for migration; new writes use `recipeIds` + DB rows.
## 7. Redis

| Key | TTL | Purpose |
|-----|-----|---------|
| `dieta:mealq:{userId}:{yyyy-MM-dd}` | ~48h | Day meal queue JSON: `status` open\|pending\|done\|failed, `items[{id,mealType,text,addedAt}]` |

Not MySQL-backed. Phase 3 **implemented** (`DietaMealQueueRedisService`).

## 8. MySQL (`infra/mysql/init.sql`)

- `dieta_profiles` — coaching profile (see columns incl. `last_non_maintain_goal_type`, `gemini_meal_consent`, `macros_customized`, `diet_baseline_method`, weekly fat/muscle, …)
- `dieta_body_logs` — daily weight (fat/muscle cols reserved)
- `dieta_intake_logs` — finalized macros + review (`source_meals_json`: queue + `recipeIds` + `knownRecipes` audit)
- `dieta_recipes` — homemade recipe analyzes (`logged_on` for day intake; list-all without date filter; `meal_type` nullable on create; `servings` + per-serving macros/kcal)
- `dieta_activity_logs` — steps / duration / activity_kcal
- `dieta_keto_events` — keto flu events
- `dieta_check_in_logs` — weekly confirm (`keep_targets`, applied_*, weights)

No food catalog / dedicated recipe bookshelf entity in MVP (list historical `dieta_recipes` rows only).

## 9. API map

### Phase 1 (implemented)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/dieta/profile` | 404 if none |
| POST | `/api/v1/dieta/onboarding` | Creates profile + ONBOARDING body log (409 if profile exists) |
| POST | `/api/v1/dieta/reset` | Wipe all Dieta data (profile, logs, recipes, Redis `dieta:mealq:{userId}:*`) → 204; then onboarding works as first-time |
| PATCH | `/api/v1/dieta/profile` | Partial update |
| POST | `/api/v1/dieta/maintain-mode` | `{ "enabled": boolean }` |
| GET/PUT | `/api/v1/dieta/body-logs` | List / upsert by `loggedOn` |
| GET/PUT | `/api/v1/dieta/activities` | List / upsert by `loggedOn` |
| GET/POST | `/api/v1/dieta/keto-events` | List / record `{ easeRequested }` |

Auth: Bearer access token · `AccessTokenResolver.requireEmail` → `users.id` UUID. All Phase 1–2 routes authenticated (`/api/v1/**`).

### Phase 2 (implemented)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/dieta/check-ins` | List `dieta_check_in_logs` |
| POST | `/api/v1/dieta/check-ins/proposal` | Server aggregates own DB intake in [weekStartsOn, loggedOn), computes proposal and returns revisionToken; supplied avgIntakeKcal/intakeDays are ignored |
| POST | `/api/v1/dieta/check-ins/apply` | Require matching revisionToken (409 if missing/stale) · upsert CHECK_IN body log · apply `keepTargets` · auto-MAINTAIN on target weight · persist check-in log |

### Phase 3 (implemented)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/dieta/meal-queue?loggedOn=` | Redis day queue; DB queueTotals preserves done after Redis expiry; expired pending lease becomes failed |
| GET | `/api/v1/dieta/meal-queue/{loggedOn}` | Same as query form |
| POST | `/api/v1/dieta/meal-queue/items` | `{ loggedOn, mealType, text }` — reject if status `done` or active `pending` |
| DELETE | `/api/v1/dieta/meal-queue/items/{itemId}?loggedOn=` | Remove item; reject done or active pending |
| POST | `/api/v1/dieta/meal-queue/finalize` | `{ loggedOn }` — requires `geminiMealConsent`; Gemini on **queue only** + `knownRecipes` from DB → merge into `dieta_intake_logs` |
| POST | `/api/v1/dieta/meal-queue/auto-finalize-yesterday` | Finalize yesterday if open+items+consent; else 204 |
| GET | `/api/v1/dieta/intakes?loggedOn=` | List intake logs (optional date filter) |
| GET | `/api/v1/dieta/recipes?loggedOn=` | With loggedOn → day LEGACY/INTAKE rows; omit → LIBRARY/LEGACY rows, filtered before newest-first limit 100 |
| POST | `/api/v1/dieta/recipes/analyze` | `{ loggedOn, title, ingredients[], steps?, servings }` → insert LIBRARY row (`meal_type` null; macros = per 1 serving), no intake write → `{ recipeId, macros, servings, oneLineReview, intake: null }` · requires `geminiMealConsent` |
| POST | `/api/v1/dieta/recipes/{id}/add-to-day` | `{ loggedOn, mealType }` — copy **1인분** macros into new day-scoped row (`meal_type` set) + upsert intake · **no Gemini**, consent not required · `mealType` required when source has null |

Config: existing `dieta.gemini.api-key` / `base-url` / `model`. Missing key disables analysis with 503; no new environment variables. HTTP connect timeout 10 seconds, read timeout 45 seconds. Validate schema/date, review and all nonnegative nutrition fields before persistence.

### Phase 4 (done — FE live)

- `frontend/src/api/dietaApi.ts` uses `apiClient` → `/api/v1/dieta/**` (Bearer + refresh like brew).
- 404 profile → `null` → onboarding redirect; guest landing stays client-only (no API).
- Check-in preview → server proposal API; confirm sends `keepTargets`, `plateauChoice`, `revisionToken`. Records and fingerprint are checked under the same profile row lock. Late UI responses are discarded. A changed record requires a fresh preview and confirmation. Target-reaching previews show maintenance kcal=TDEE and activity=0, matching apply.
- Meal finalize/auto-finalize → live Redis queue + Gemini; failures preserve queue input and expose retry. Recipe failures preserve form input.
- Historical `dietaStubStore` remains unused by live routes. Server aggregation uses only recorded dates as the average denominator; missing dates are not zero-calorie days. Existing coaching constants and no-intake fallback remain unchanged.

### Phase 5 / 5b (homemade recipe → DB + knownRecipes)

- FE: Meals 「등록 음식」 modal → `GET /recipes` + `POST /recipes/{id}/add-to-day` (mealType); in-modal 「추가하기」 → servings + `POST /recipes/analyze` (no mealType); day's recipes via `GET /recipes?loggedOn=`.
- BE: register LIBRARY rows with nullable meal_type and per-serving nutrition; add-to-day creates INTAKE rows with mealType and merges intake. Existing rows use LEGACY and retain original intake semantics. Legacy JSON-only recipes remain represented across new adds and finalize.
- Tests: `DietaIntakeSourceDocumentTest`, `DietaGeminiRequestBuilderTest` (knownRecipes + perServing), `DietaPhase5RecipeIT` (list-all + add-to-day + servings validation).
## 10. FE reference

- `frontend/src/api/dietaApi.ts` · `frontend/src/api/dietaMappers.ts`
- `frontend/src/features/dieta/types.ts`
- `frontend/src/features/dieta/utils/dietaMath.ts`
- `frontend/src/features/dieta/utils/dietaGeminiStub.ts` (legacy FE helpers; finalize is server-side)
- `docs/screenshots/dieta/WIREFRAMES.md`

## 11. Reliability and deployment (2026-10-31)

- Apply `infra/mysql/migrations/20261031_dieta_recipe_kind.sql` once before deploying the matching backend/frontend together. Do not run old and new backend versions concurrently: old code includes library rows in day totals. Reload old browser sessions. Historical intake is not recalculated or deleted by the migration.
- Queue retention is unchanged: 48-hour TTL, no new scheduler or permanent queue storage, yesterday auto-finalize still triggered by visiting Meals.
- Queue add/remove, lease claim/recovery, reset, and final DB commit serialize under a per-user profile write lock at READ_COMMITTED. This is intentionally coarser than per-day locking. No external AI call runs inside that transaction.
- pending.updatedAt identifies a 120-second analysis lease. GET recovers expired pending to failed. Every takeover and final ownership check uses the same DB lock, so an expired worker cannot save after a replacement claims the queue. Pending edits and concurrent finalization return 409.
- The final DB transaction re-reads day recipes. A successful commit writes queueTotals as durable completion evidence before Redis done is attempted. Redis completion failure is recoverable from DB without reanalysis. Repeated done finalization returns the persisted intake, including after Redis expiry.
- Recipe registration and weekly apply API semantics changed; deploy clients with the backend. Old apply requests without revisionToken receive 409 and must reload/re-preview.

## UI/UX update — 2026-10-31

- Home prioritizes food/weight entry, then analyzed intake and weight trends. No analyzed intake displays “—”, while a logged zero remains 0. Pending queue entries are separate from analyzed totals.
- Desktop uses a maximum 1040px shell and two-column home; mobile retains four bottom links. Check-in reminders lead only when due; otherwise recording comes first.
- Dieta portals share app theme tokens. Mobile dialogs are bottom sheets; desktop dialogs are centered. Existing Dialog focus trap, Escape and focus restoration remain.
- Settings use explicit target/advanced/AI-consent save and cancel. Only genuinely dirty fields survive route navigation in memory; clean fields come from refreshed server data. Drafts clear on logout/account change, and retained drafts protect reload with beforeunload. Late responses from obsolete page/session instances cannot rewrite them.
- All-data reset is labeled “모든 기록 삭제 후 다시 시작” in Data management, with confirmation. No endpoint semantics change.
- Profile-dependent initial reads occur after confirming onboarding; initial errors expose retry rather than showing empty data. New users are directed to onboarding.
- Introduction assets `dieta-product-ui*.png` contain synthetic demonstration records only.
- Isolated verification: `vitest --config vitest.dieta.config.ts`; `vite build --config vite.dieta-review.config.ts`; `playwright test --config playwright.dieta.config.ts` after that build. These configs disable environment-file loading. Browser tests mock `/api/v1/**`; they do not exercise live DB, Redis or Gemini.
