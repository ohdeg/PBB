# Dieta 기록 신뢰성 개선 Implementation Plan

> **For agentic workers:** 구현 시 `executing-plans`를 사용한다. 한 구현자가 순차 실행하며 누락된 companion script는 사용하지 않는다. 현재 요청은 계획 안내까지이며 구현은 시작하지 않는다.

**Goal:** AI 실패를 명시하고 식사 큐 경쟁 조건을 막으며 레시피 보관과 섭취를 분리하고 주간 계산을 서버로 통일한다.

**Architecture:** React의 표시와 입력 흐름은 유지하고 Spring을 분석 결과·섭취 집계·목표 제안의 기준으로 삼는다. Redis 큐의 48시간 TTL과 화면 진입 시 전날 자동 분석 정책은 유지한다. MySQL의 기존 기록은 보존한다.

**Tech Stack:** React 19 / TypeScript, Spring Boot 4 / Java 25, MySQL, Redis, Gemini.

**Spec:** `docs/dieta/FEATURE_SPEC.md` 및 2026-10-31 사용자 요청(1·2·4·5번 개선 계획, 3번 유지). 레시피 등록 및 stub 정책은 기존 명세를 변경하는 제안이다.

## Global Constraints

- 실제 환경 파일, 비밀 값, ignored 경로에는 접근하지 않는다. 실행 도구가 이를 간접 로드하는 것도 금지한다.
- 기존 체중 계산 상수, 7일 기준, keepTargets, 목표 도달 시 유지 모드 규칙은 변경하지 않는다.
- 기존 기록의 분석 출처를 추정하거나 과거 섭취량을 자동 차감하지 않는다.
- 신규 환경 변수 없이 운영의 암묵적 stub을 제거하고 테스트에서만 mock 분석기를 주입하는 방향을 기본안으로 한다.
- 변경 전 UI 지침 확인 → 기존 디자인을 유지하며 구현 → 지침 및 실제 브라우저 동작 재검증.

## Review Focus

- AI timeout·잘못된 응답이 정상 영양 기록으로 저장되는 경우: Task 1.
- 분석 중 수정·중복 마감·프로세스 중단·DB commit 실패: Task 2.
- 과거 레시피의 섭취 기록 보존 및 신규 등록 후 중복 합산: Task 3.
- 다른 날짜·사용자 데이터 또는 클라이언트 집계가 목표 계산에 섞이는 경우: Task 4.
- 미리보기 응답 역전 및 확인 전 원본 데이터 변경: Task 4.

## Task 1 — 실패를 정상 분석과 분리

**Files:** `spring_backend/.../domain/dieta/client/GeminiMealClient.java`, `service/DietaService.java`, `dto/gemini/DietaGeminiMealResponse.java`, `frontend/src/pages/DietaMealsPage.tsx`, `frontend/src/components/dieta/DietaRecipeModal.tsx`. 테스트 추가: `spring_backend/src/test/java/com/studiobs/spring_backend/domain/dieta/client/GeminiMealClientTest.java` 및 기존 Phase3/Phase5 IT.

**Interface:** 기존 analyze(request)의 성공 응답은 유지한다. 키 미설정은 503, 외부 호출/응답 검증 실패는 502로 매핑하고 사용자에게 재시도 가능한 메시지를 전달한다. 키·원문 외부 오류를 UI에 노출하지 않는다.

- [ ] 키 없음, timeout, 파싱 실패, 누락·음수 영양 값에서 실패하고 섭취/레시피가 생성되지 않는 테스트를 먼저 추가한다.
- [ ] 운영 stub fallback을 제거하고 응답 검증 및 요청 timeout을 명시한다. 테스트는 실제 키 없이 성공/실패 응답을 주입한다.
- [ ] 실패한 큐는 내용을 보존하고 failed 상태 및 재시도 버튼을 표시한다. 레시피 입력값도 유지한다. 전날 자동 분석 실패도 사용자가 확인하도록 표시한다.
- [ ] 기존 실패 전 정상 기록은 변경되지 않고, 재시도 성공 시 한 번만 반영되는지 확인한다.

## Task 2 — 큐 상태 변경과 마감의 동시성 보장

**Files:** `service/DietaMealQueueRedisService.java`, `service/DietaService.java`, `support/DietaIntakeSourceDocument.java`, `frontend/src/pages/DietaMealsPage.tsx`, 기존 Phase3 IT. 필요 지원 파일: 동일 service 디렉터리의 `DietaMealFinalizeCoordinator.java`.

**Interface:** open/failed → pending → done 또는 failed. pending의 추가·삭제·재마감은 409. done의 추가·삭제도 409, 재마감은 저장된 결과 반환. 사용자+날짜를 동시성 단위로 사용한다.

- [ ] 동시 추가 두 건 모두 보존, pending 수정 거부, 동일 마감 중복 호출, done 삭제 거부를 실제 Redis 동시 요청 테스트로 고정한다.
- [ ] Redis Lua/CAS로 목록 변경과 상태 전환을 원자적으로 수행한다. 분석 작업에는 소유 토큰·만료 시점을 두고 만료된 작업의 결과 저장을 거부한다. 큐 TTL 48시간은 유지한다.
- [ ] 외부 AI 호출을 긴 DB 트랜잭션 밖으로 이동한다. 짧은 최종 저장 트랜잭션은 사용자 프로필 행 잠금 등 동일한 직렬화 규칙을 사용해 레시피 섭취 추가와 합산 충돌을 방지한다.
- [ ] DB에 마감 식별자/완료 정보를 섭취 source 문서로 남기고 commit 후 Redis done을 반영한다. DB 성공·Redis 실패 시 다음 요청은 DB 완료 정보를 확인해 결과를 복구하며 재분석하지 않는다.
- [ ] 프로세스 중단 후 임대 만료 복구, 오래된 작업 응답 무시, DB rollback, Redis 완료 저장 실패, 레시피 추가와 마감 경쟁을 검증한다. 만료 복구는 요청 시 수행하며 새 스케줄러를 도입하지 않는다.

## Task 3 — 레시피 보관과 섭취 분리

**Files:** Dieta `entity/DietaRecipe.java`, `repository/DietaRecipeRepository.java`, `service/DietaService.java`, `dto/meal/DietaRecipeAnalyzeResponse.java`; `frontend/src/features/dieta/types.ts`, `frontend/src/api/dietaMappers.ts`, `frontend/src/components/dieta/DietaRecipeModal.tsx`, `DietaRecipeLibraryModal.tsx`, `frontend/src/pages/DietaMealsPage.tsx`; 새 SQL migration 및 init.sql; 기존 Phase5 IT와 mapper 테스트.

**Interface:** analyze는 보관용 레시피와 1인분 분석 결과만 생성한다. 응답 intake는 nullable로 전환한다. add-to-day만 1인분 섭취 행을 생성한다. recipe 행에 `record_kind`(LEGACY / LIBRARY / INTAKE)를 추가한다.

- [ ] 등록 전후 당일 kcal 동일, 섭취 추가 1회 시 1인분 증가, 다른 날 재사용, N인분 레시피의 1인분 환산 테스트를 추가한다.
- [ ] 기존 행은 LEGACY로 보존하고 기존 집계에 포함한다. 신규 LIBRARY는 당일 합계 및 knownRecipes에서 제외하고 신규 INTAKE만 포함한다. 보관함은 LIBRARY와 기존 LEGACY를 보여주며 새 INTAKE 복사본은 숨긴다.
- [ ] 등록 모달에는 ‘레시피 보관함에 저장’, 섭취 버튼에는 ‘오늘 1인분 추가’를 표시한다. 자동 섭취 반영 안내를 제거한다. 재사용에는 추가 Gemini 호출이나 동의를 요구하지 않는다.
- [ ] 스키마를 먼저 확장하고 프런트·백엔드의 의미 변경을 함께 배포한다. 오래 열린 클라이언트는 새로고침하도록 운영 배포 절차에 포함한다. 과거 기록을 삭제하거나 등록분으로 추정해 차감하지 않는다.
- [ ] 기존 LEGACY 기록 및 마감 재합산 결과가 동일함을 migration/회귀 테스트로 확인한다.

## Task 4 — 주간 집계와 제안을 서버로 통일

**Files:** `service/DietaService.java`, `repository/DietaIntakeLogRepository.java`, check-in 요청/응답 DTO; `frontend/src/api/dietaApi.ts`, `dietaMappers.ts`, `frontend/src/pages/DietaHomePage.tsx`, `DietaCheckInPage.tsx`, `frontend/src/components/dieta/DietaWeekPlanModal.tsx`; 기존 Phase2 IT 및 프런트 테스트.

**Interface:** proposal/apply는 해당 사용자의 DB 섭취 기록을 `[weekStartsOn, loggedOn)` 범위로 집계한다. 기록된 날짜만 분모로 사용하고 평균은 기존처럼 반올림한다. 미기록일을 0kcal로 계산하지 않는다. 구형 avgIntakeKcal/intakeDays 필드는 전환기 수용하되 무시한다.

- [ ] 날짜 경계, 기록 없음, 부분 기록, 위조된 클라이언트 집계, 타 사용자 기록 제외, keepTargets와 자동 유지 모드 회귀 테스트를 추가한다.
- [ ] proposal/apply가 같은 서버 집계 함수를 사용하게 한다. 기존 수식과 무기록 fallback을 보존한다.
- [ ] 홈/체크인 미리보기를 기존 proposeCheckIn API로 교체한다. 입력 변경 시 이전 응답을 무시하고 새 제안이 준비되기 전 확인을 비활성화한다.
- [ ] 제안 입력·관련 기록의 revision token을 응답하고 apply에서 비교한다. 기록 변경 시 409로 새 제안을 표시해 재확인하게 한다. 토큰은 사용자·체중·선택·프로필·기준 체중·섭취 집계에 결합하며 서버에서 검증한다.
- [ ] 지연된 응답 역전, 미리보기 실패, 확인 전 기록 변경, 이중 확인 요청을 검증한다. 기존 FE 계산 함수는 다른 사용처를 확인한 뒤 불필요한 호출만 제거한다.

## Execution and verification

순서: Task 1 → Task 2 → Task 3 → Task 4 → 명세 갱신 → 실제 diff 리뷰 → 영향받은 검사 재실행. 구현은 한 명이 담당한다. 데이터 무결성 설계/리뷰는 프로젝트의 고위험 단계 모델 선호를 적용할 수 있을 때 적용한다. 현재 계획은 부모 에이전트 자체 검토이며 모델/effort는 확인되지 않았다.

- [ ] 각 작업은 실패 테스트 확인 → 구현 → 집중 테스트 순으로 진행한다.
- [ ] 허용된 실행 환경에서 백엔드 `./gradlew test --tests '*Dieta*'`, 프런트 `npm test -- dieta`, `npm run lint`, `npm run build`를 실행한다. 명령 실행 전 의존성·출력·dotenv 로딩 경로를 점검한다.
- [ ] 현재 node_modules, .gradle, build 등은 접근 금지이므로 이 경로를 사용하는 명령은 그대로 실행하지 않는다. 허용된 비ignored 실행 구성이 없으면 사용자 로컬 검증으로 남기고 통과를 주장하지 않는다.
- [ ] 브라우저에서 분석 실패/재시도, 두 탭 동시 수정, 레시피 저장 후 섭취 추가, 주간 제안 로딩/실패/갱신을 모바일·데스크톱으로 확인한다. 실제 비밀 설정을 읽는 서버는 실행하지 않는다.
- [ ] FEATURE_SPEC의 stub, 레시피, 주간 집계 계약을 갱신한다. 48시간 큐 TTL과 전날 자동 분석은 회귀 확인만 한다.

## Plan review

요구 범위 1·2·4·5 및 3 유지, 기존 기록 보존, API 의미 변경, 실패 복구, 날짜 집계, 테스트와 실행 제한을 자체 검토했다. 사용자에게 제안하는 계획이며 애플리케이션 변경이나 테스트 실행은 수행하지 않았다.
