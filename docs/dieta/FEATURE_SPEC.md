# Dieta — Feature Spec (product contract)

> Source of truth for FE stub + Spring BE + MySQL + Redis + Gemini.  
> Do not invent product rules beyond this doc, Notion Dieta page, and FE types/`dietaMath`.  
> Status: **Phase 0** (this doc) · **Phase 1** BE profile/body/activity/keto live · **Phase 2** weekly check-in live · **Phase 3** Redis meal queue + Gemini finalize live · **Phase 4** FE wired to `/api/v1/dieta/**` (auth Bearer via `apiClient`; guest landing client-only) · **Phase 5** homemade recipe → `dieta_recipes` + immediate Gemini → intake merge · **Phase 5b** finalize sends `knownRecipes` from DB.

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
4. Step kcal knobs (LOSS/GAIN) + **`geminiMealConsent`**.

On complete: `onboardingComplete=true`, `weekStartsOn=today`, `weekActivityExtraKcal=0`, body log `source=ONBOARDING`, `dietBaselineMethod=SURVEY`, `lastNonMaintainGoalType` = GAIN if goal GAIN else LOSS.

## 5. Screens / UX (summary)

- Landing (auth optional; skip to home if onboarded).
- Home: daily macros preview, weight chart, optional fasted weight, check-in CTA, keto modal.
- Meals: daytime queue by mealType; finalize → Gemini → intake log. Homemade recipe via 「등록 음식」→「추가하기」 → immediate Gemini → `dieta_recipes` + same-day intake (not Redis queue); same modal select → copy recipe to today (`add-to-day`); finalize passes `knownRecipes`.
- Activity: steps / minutes / activity kcal (known fields only); week extra kcal hint.
- Check-in: 7-day gate (`today − weekStartsOn ≥ 7`); weight; proposal modal with keepTargets.
- Settings: maintain toggle, targets, step kcal, Gemini consent, re-onboard.

Nav: 홈 · 섭취 · 활동 · 설정 (no progress tab; `/progress` → home).

## 6. Gemini meal finalize contract

Request `schemaVersion: 1`, `locale: 'ko-KR'`:

- `goalHint`: `{ goalType, maintainKcal (TDEE), dailyKcalTarget, targetWeightKg? }`
- `meals`: `[{ mealType, items: string[] }]` — **Redis queue one-line items only** (never include homemade recipe text)
- `knownRecipes`: `[{ name, kcal, carbG, proteinG, fatG }]` — day's rows from `dieta_recipes` (pre-analyzed; do not re-estimate into `totals`)
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
- Inserts a row into **`dieta_recipes`** (day-scoped by `logged_on` for intake merge; historical rows remain listable). Macros/kcal columns = **per serving**.
- Upserts same-day `dieta_intake_logs`: appends id to `source_meals_json.recipeIds[]` and sets row totals = `sum(DB recipes for day) + queueTotals` (`queueTotals` null until day finalize). Create-day row may have `meal_type` null.
- Day finalize loads DB recipes → sends `knownRecipes` to Gemini; analyzes **only Redis queue text items** into `queueTotals`; writes `recipeIds` + `knownRecipes` audit snapshot; merges macros (no double-count).
- Requires `geminiMealConsent`. Blank Gemini API key → BE stub (same as finalize; stub divides batch macros by `servings` when `perServingOnly`).
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
| POST | `/api/v1/dieta/onboarding` | Creates profile + ONBOARDING body log |
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
| POST | `/api/v1/dieta/check-ins/proposal` | Server computes week proposal (X÷1.2, bands, TDEE). Optional `avgIntakeKcal`/`intakeDays` until Phase 3 intake API |
| POST | `/api/v1/dieta/check-ins/apply` | Upsert CHECK_IN body log · apply `keepTargets` · auto-MAINTAIN on target weight · persist check-in log |

### Phase 3 (implemented)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/dieta/meal-queue?loggedOn=` | Redis day queue (empty open if missing) |
| GET | `/api/v1/dieta/meal-queue/{loggedOn}` | Same as query form |
| POST | `/api/v1/dieta/meal-queue/items` | `{ loggedOn, mealType, text }` — reject if status `done` |
| DELETE | `/api/v1/dieta/meal-queue/items/{itemId}?loggedOn=` | Remove item |
| POST | `/api/v1/dieta/meal-queue/finalize` | `{ loggedOn }` — requires `geminiMealConsent`; Gemini (or stub) on **queue only** + `knownRecipes` from DB → merge into `dieta_intake_logs` |
| POST | `/api/v1/dieta/meal-queue/auto-finalize-yesterday` | Finalize yesterday if open+items+consent; else 204 |
| GET | `/api/v1/dieta/intakes?loggedOn=` | List intake logs (optional date filter) |
| GET | `/api/v1/dieta/recipes?loggedOn=` | Optional `loggedOn` — day filter; omit → all user recipes, `createdAt` desc, limit 100 |
| POST | `/api/v1/dieta/recipes/analyze` | `{ loggedOn, title, ingredients[], steps?, servings }` → insert `dieta_recipes` (`meal_type` null; macros = per 1 serving) + upsert intake → `{ recipeId, macros, servings, oneLineReview, intake }` · requires `geminiMealConsent` |
| POST | `/api/v1/dieta/recipes/{id}/add-to-day` | `{ loggedOn, mealType }` — copy **1인분** macros into new day-scoped row (`meal_type` set) + upsert intake · **no Gemini**, consent not required · `mealType` required when source has null |

Config: `dieta.gemini.api-key` / `base-url` / `model` (optional). Blank API key → deterministic stub honoring `estimateActivityKcalIfMissing` / `missingAmountAsOneServing`.

### Phase 4 (done — FE live)

- `frontend/src/api/dietaApi.ts` uses `apiClient` → `/api/v1/dieta/**` (Bearer + refresh like brew).
- 404 profile → `null` → onboarding redirect; guest landing stays client-only (no API).
- Check-in confirm → `POST /check-ins/apply` (`keepTargets`, `plateauChoice`, intake avg/days); modal preview still uses client `dietaMath`.
- Meal finalize/auto-finalize → live Redis queue + Gemini (BE stub if API key blank).
- Remaining: BE may still use Gemini stub without key; optional server-side intake avg for proposal (FE still sends avg/days); unused `dietaStubStore` left in tree.

### Phase 5 / 5b (homemade recipe → DB + knownRecipes)

- FE: Meals 「등록 음식」 modal → `GET /recipes` + `POST /recipes/{id}/add-to-day` (mealType); in-modal 「추가하기」 → servings + `POST /recipes/analyze` (no mealType); day's recipes via `GET /recipes?loggedOn=`.
- BE: insert `dieta_recipes` with nullable `meal_type`, `servings`, per-serving macros; intake `recipeIds` + merge on finalize; Gemini `perServingOnly`; list-all when `loggedOn` omitted; add-to-day copies 1인분 macros + sets mealType.
- Tests: `DietaIntakeSourceDocumentTest`, `DietaGeminiRequestBuilderTest` (knownRecipes + perServing), `DietaPhase5RecipeIT` (list-all + add-to-day + servings validation).
## 10. FE reference

- `frontend/src/api/dietaApi.ts` · `frontend/src/api/dietaMappers.ts`
- `frontend/src/features/dieta/types.ts`
- `frontend/src/features/dieta/utils/dietaMath.ts`
- `frontend/src/features/dieta/utils/dietaGeminiStub.ts` (legacy FE helpers; finalize is server-side)
- `docs/screenshots/dieta/WIREFRAMES.md`
