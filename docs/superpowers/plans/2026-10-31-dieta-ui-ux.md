# Dieta UI/UX 개선 Implementation Plan

> 실행 담당자: `executing-plans`로 순차 구현한다. 프로젝트 AGENTS.md의 보안·비례적 검증 규칙이 우선한다. 이 문서는 검토 및 계획이며 구현 완료 보고가 아니다.

**Execution status (2026-10-31):** UI implementation and review fixes applied. Actual verification and limitations: [execution ledger](2026-10-31-dieta-ui-progress.md). Original checklists below describe the planned scope; the ledger is the execution record.

**Goal:** Dieta를 오늘의 기록과 주간 변화를 쉽게 이해하는 체중 코칭 노트로 개선한다.
**Architecture:** 기존 React 라우트·API·코칭 계산을 유지하고 Dieta 공통 레이아웃, 표시 상태, 입력 흐름을 개선한다. 공통 Dialog는 재사용하며 Dieta 포털에도 테마 범위를 명시한다.
**Tech Stack:** React 19, React Router 7, TypeScript, CSS custom properties, lucide-react, Vitest/Testing Library, Playwright.
**Spec:** 이 문서의 디자인 결정 및 `docs/dieta/FEATURE_SPEC.md`. 기능 계약과 충돌하는 UI 문구 변경은 해당 스펙도 함께 갱신한다.

## 1. 검토 근거와 범위

- 2026-10-31 최신 작업 트리의 Dieta 페이지 8개, 공통 CSS, 차트·레시피·주간 계획 모달, Dialog, App 라우팅, 관련 API/테스트/기능 명세 검토.
- 기존 미커밋 신뢰성 개선이 있으므로 HEAD가 아닌 현재 파일을 기준으로 계획했다. 기존 변경을 되돌리지 않는다.
- 로그인 후 Chrome DevTools로 홈, 식사, 활동, 설정, 주간 체크인 화면과 등록 음식 모달을 확인했다. 모달 열기/Escape 닫기는 실행했다. 입력 저장·분석·초기화·계획 적용은 실행하지 않았다.
- 데스크톱 화면과 390×844 모바일 에뮬레이션을 확인했다. 모바일 document clientWidth=390에 scrollWidth=398, 공통 헤더 right=398을 관찰했다. 처음 resize 도구는 실제 innerWidth=500으로 제한되어 이를 390px 검증으로 세지 않았다.
- 다크 모드 화면과 등록 음식 모달의 테마 불일치를 실제 확인했다. 홈은 라이트/다크 모두 확인하고 원래 다크 모드로 복구했다. 1440×1000에서 본문 폭 480px, 체중 입력 상단 y=1153px로 첫 화면 밖이었다. 온보딩 전체 진행, 채워진 차트, API 실패·저장 결과는 추가 검증 대상이다.
- 기존 `docs/screenshots/dieta/dieta-wire-*.png`는 과거 와이어프레임이다. 체성분 3종·추이 탭을 최신 구현으로 오인하지 않는다. MVP는 체중만 지원한다.
- 접근성 참고: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md (2026-10-31 조회). 전역 focus-visible, reduced-motion과 Dialog 포커스 트랩/복귀는 이미 구현되어 있어 누락으로 보고하지 않는다.

## 2. 변경 필요 사항

| 우선순위 | 발견 및 근거 | 개선 방향 |
|---|---|---|
| P1 | `frontend/src/features/dieta/dieta.css:2`, `frontend/src/components/ui/Dialog.tsx:154`: 테마 변수는 `.dieta-app`에 있으나 Dialog는 body 포털. 다크 화면에서 등록 음식은 흰색 패널·파란 버튼으로 표시됨 | Dieta 모달 루트도 동일 토큰 스코프를 받게 한다. 전역 모든 Dialog 색상을 바꾸지 않는다 |
| P1 | `frontend/src/index.css:279`: 모바일에서 공통 헤더가 viewport보다 8px 넓음. 음수 margin과 상위 padding 관계 추가 확인 필요 | 원인 확정 후 실제 폭 수정. overflow:hidden으로 잘라 숨기지 않는다. 다른 앱 헤더 회귀 검사 |
| P1 | `frontend/src/pages/DietaSettingsPage.tsx:176`: blur 즉시 저장, 명시적 저장 버튼 부재. 고급 수치도 같은 방식이고 저장 실패 처리가 부족함 | 섹션별 편집→검증→저장/취소, 진행·실패·미저장 상태 명시 |
| P1 | `frontend/src/pages/DietaSettingsPage.tsx:107`: 전체 기록 삭제 기능이 ‘온보딩 다시’로 상단에 배치됨. 확인창은 이미 있음 | 최하단 ‘데이터 관리’에 ‘모든 기록 삭제 후 다시 시작’. 삭제 범위를 확인창에도 표시 |
| P1 | `frontend/src/pages/DietaHomePage.tsx:80`, `frontend/src/pages/DietaActivityPage.tsx:28`, `frontend/src/pages/DietaSettingsPage.tsx:22`: 초기 조회 실패를 화면 오류/재시도로 전환하지 못하는 경로 | 로딩·빈 상태·실패·성공 구분. 실패를 무기록/0으로 표현하지 않는다 |
| P1 | `frontend/src/pages/DietaOnboardingPage.tsx:154`, `frontend/src/pages/DietaActivityPage.tsx:158`, `frontend/src/pages/DietaSettingsPage.tsx:172`: label과 input 연결 누락. 실제 활동/설정 접근성 트리에 이름 없는 textbox 노출 | id/htmlFor, inputMode, name, 오류 aria-describedby 및 alert/status 제공 |
| P2 | `frontend/src/features/dieta/dieta.css:43`: 데스크톱도 480px 단일 열. 실제 화면에서 좌우가 크게 비고 기록 동선이 길어짐 | 데스크톱 1040px 최대폭, 2열 홈, 상단 앱 내비. 모바일 단일 열·하단 내비 |
| P2 | `frontend/src/pages/DietaHomePage.tsx:356`: 체중 그래프 다음에 체중 입력. 체크인 안내와 저장 버튼이 서로 다른 경로를 설명 | 기록 행동을 차트 위에 배치. 체크인 날은 기록 입력과 제안 흐름의 관계를 한 문장으로 명시 |
| P2 | `frontend/src/pages/DietaMealsPage.tsx:261`: ‘큐’, ‘마감’, 긴 설명으로 저장·분석·영양 반영 차이를 학습해야 함 | ‘오늘 식사’, ‘분석 대기’, ‘오늘 기록 확정하고 분석’. 확정 이후 한 줄 음식 추가 불가를 실행 전 설명 |
| P2 | `frontend/src/pages/DietaHomePage.tsx:306`: 기록 없음도 0 kcal 표시. 분석 대기 식사는 합계에 아직 반영되지 않음 | ‘분석된 섭취량’과 미분석 기록 상태를 구분. 실제 기록된 0과 미기록을 구분 |
| P2 | `frontend/src/pages/DietaOnboardingPage.tsx:49`: 미리보기 TDEE가 2200 고정. 개인 입력을 반영한 결과로 오해 가능 | 기존 계산 helper/서버 계약에 맞춘 미리보기 또는 확정 전 수치 미표시. 새 계산식 도입 금지 |
| P2 | `frontend/src/pages/DietaLayout.tsx:3`: ◈·◎·△·◍ 기호의 의미가 약함 | lucide Home, Utensils, Footprints, Settings 및 ‘홈·식사·활동·설정’ 텍스트 |
| P2 | `frontend/src/pages/DietaCheckInPage.tsx:205`, Settings: W·δ·TDEE/BMR·단일 비교 등 전문 용어 | ‘주간 목표 변화’, ‘하루 예상 소비량’, ‘기초대사량’. 계산 근거는 상세 영역 |
| P2 | `frontend/src/features/dieta/dieta.css:112`: 다크 primary는 밝은 민트 배경+흰 글자 | 다크 primary 전용 짙은 글자 토큰 적용, 대비 측정. disabled 스타일과 활성 스타일 구분 |
| P3 | `frontend/src/components/dieta/DietaCharts.tsx:264`: 선 색상 고정, 작은 축 라벨·중복 제목 | 테마 토큰·요약 문장·데이터 표 보기. 빈/단일 점/조밀한 데이터 각각 확인 |

## 3. 디자인 방향

**‘차분한 기록 노트’**: 사용자가 오늘 먹은 것과 몸의 변화를 바로 기록하고, 일주일 단위로 돌아볼 수 있게 한다. 기존 민트와 Pretendard를 유지한다. 식사·체중 기록 행 자체가 시각적 중심이며 장식용 링 차트나 동일한 카드 나열은 추가하지 않는다.

- 기본색 6개: 배경 `#F5F5F7`, 표면 `#FFFFFF`, 본문 `#1D1D1F`, 보조 본문 `#62666B`, 브랜드 `#1F7A64`, 강조 배경 `#E6F3EE`. 경고/오류 색상은 기존 의미를 보존하되 접근성 기준으로 조정한다.
- 다크: 배경 `#1D1D1F`, 표면 `#2C2C2E`, 본문 `#F5F5F7`, 보조 `#B0B4BA`, 브랜드 `#3DD6B3`, primary 글자 `#102B24`. 실제 조합 대비를 검사해 확정한다.
- Pretendard 유지. 제목 24–28px/600, 주요 수치 32px/600, 본문 16px/400, 보조 14px. 숫자에 tabular-nums, 단위는 수치보다 작게 하되 읽을 수 있게 유지.
- 간격 4/8/12/16/24/32px. 주요 표면 radius 16px, 입력 10px, 상태 pill만 완전 둥글게. 그림자보다 간격과 명도 차이로 구분.
- 왼쪽 정렬. 모바일 좌우 16px. 768px 미만 단일 열, 768–1023px 여유 있는 단일 열, 1024px 이상 2열. 데스크톱 전체 최대 1040px, 열 비율 1.5:1, gap 24px.
- 주 행동 하나를 가장 강하게 표현. 체크인 날짜에는 체크인, 일반 날에는 식사 기록을 우선한다. 체중 기록은 같은 첫 작업 영역에 제공.
- 키토 관련 안내를 전체 서비스의 대표 문구로 쓰지 않고 필요한 맥락의 보조 기능으로 배치. 기존 증상 기록 기능은 보존. 의학적 효능·정량 권고 카피는 별도 근거 검토 대상으로 두며 새로 만들지 않는다.

## 4. 제안 레이아웃과 화면별 동선

데스크톱 홈:

```text
PBB 공통 헤더
Dieta                           홈   식사   활동   설정
오늘 날짜 / 현재 목표
┌ 오늘 기록하기 ───────────────────┬ 이번 주 ──────────────┐
│ 식사 기록 버튼 / 체중 입력·저장    │ 체크인 일정·현재 상태   │
├ 오늘 식사 요약 ──────────────────┤ 체크인 가능 시 시작 CTA│
│ 분석된 섭취량 / 목표              ├──────────────────────┤
│ 탄수화물 · 단백질 · 지방          │ 기록 안내·도움말       │
├ 체중 변화 · 기간 선택 ────────────┴──────────────────────┤
│ 최신 기록·기간 변화 / 그래프 / 데이터 보기               │
└────────────────────────────────────────────────────────┘
```

모바일 홈 순서: 날짜/목표 → 체크인 알림(해당 시) → 오늘 기록하기 → 식사 요약 → 체중 변화 → 도움말. 하단 내비는 4개 유지하고 safe-area 및 마지막 콘텐츠 여백 확보. 통계용 독립 탭은 새로 만들지 않는다.

| 화면 | 최종 구성과 동선 |
|---|---|
| 소개 | ‘식사와 체중을 기록하고, 한 주씩 돌아보세요.’ + 실제 제품 화면 + ‘Dieta 시작하기’. 로그인 사용자 ‘오늘 보기’. 공통 랜딩 전체를 재설계하지 않음 |
| 첫 설정 | 기존 4단계 유지: 내 정보 → 목표와 생활 → 식사 방식 → 확인하고 시작. BMR 직접 입력·가감 수치는 선택 상세로 접음. 최종 목표·동의 요약, 단계별 필드 오류 |
| 홈 | 기록 우선, 분석된 합계/미분석 구분, 기간 내 기록 없으면 ‘이 기간에 기록이 없어요’와 첫 기록 동선. 줄임말 대신 영양소 전체 이름 |
| 식사 | 끼니 선택 → 한 줄 입력 또는 ‘저장한 음식에서 선택’ → 오늘 식사 목록 → 확정·분석. 레시피 생성은 보관만 하고, 오늘 추가는 별도라는 현재 계약을 명시 |
| 식사 상태 | 기록 없음 / 분석 대기 / 분석 중 / 실패·재시도 / 확정 완료. 상태별 안내와 가능한 행동을 한 곳에 표시. 영양값 없는 행을 0 kcal로 만들지 않음 |
| 활동 | 오늘 입력을 중심으로, 목표는 걸음·시간의 대안 예시임을 명시. 모두 해야 하는 것으로 보이지 않게 ‘또는’ 표시. 빈 항목=미입력, 0=0 기록 구분 |
| 주간 체크인 | 체중 입력 → 이번 기록 기준 요약 → 다음 주 제안 비교(현재/제안) → 적용 결과. ‘현재 목표 유지’와 ‘제안 적용’의 효과 설명. stale proposal 보호 유지 |
| 설정 | 목표/식사 방식 요약 → 목표 편집 → 고급 조절(접힘) → AI 분석 동의 → 데이터 관리. 자동 저장 대신 섹션별 저장/취소 |
| 모달 | 모바일 바텀 시트·데스크톱 중앙 패널. 일관된 토큰·제목·닫기·주 행동. 긴 내용만 내부 스크롤, footer와 safe-area 확보 |

## 5. Global Constraints

- 실제 `.env`, 비밀 파일, 프로세스 환경 값을 읽거나 변경하지 않는다. 이 계획은 환경 변수 추가를 요구하지 않는다.
- 기존 dev 접근 제한·인증을 유지한다. 실제 사용자 기록에 테스트 데이터를 저장하지 않는다.
- 체중-only, 7일 경과 체크인, 목표 도달 유지 전환, 레시피 보관/오늘 추가 구분, 분석 중 잠금, revisionToken 검증을 보존한다.
- 외부 API/DB 스키마 변경은 기본 범위가 아니다. 화면 표시용 상태와 기존 API 결과를 이용한다.
- 신규 API가 필요한 실시간 개별 음식 분석, 확정 후 재편집, 음식 검색 DB는 이번 범위에 포함하지 않는다.
- 전역 스타일/공유 Dialog 수정은 다른 앱 회귀 범위를 명시한다. 기존 미커밋 변경과 테스트를 보존한다.

## 6. Review Focus

1. 데이터 없음·분석 대기·조회 실패가 모두 0으로 합쳐지지 않는가 → Task 2/3 상태 테스트.
2. 수정 중 목표/AI 제안 변경 시 오래된 값이 저장되지 않는가 → Task 4/5 입력 및 pending 테스트.
3. 포털 모달이 다크 테마·포커스·내부 스크롤을 유지하는가 → Task 1 브라우저 검사.
4. 모바일 320/390px, 확대 200%, 긴 음식 이름에 가로 넘침/하단 가림이 없는가 → Task 1/3/6.
5. LOSS/GAIN/MAINTAIN 및 체크인 가능/불가의 행동과 문구가 실제 서버 계약과 맞는가 → Task 2/4/5 회귀 테스트.

## 7. 실행 순서

### Task 1 — 공통 레이아웃·테마·접근성 기반

**Files:** `frontend/src/pages/DietaLayout.tsx`, `frontend/src/features/dieta/dieta.css`, 필요 시 `frontend/src/index.css`; Dieta 모달 4개. 공유 Dialog 변경은 필요한 경우만.
**Interfaces:** 기존 Outlet/NavLink 유지. 포털 backdrop에 `.dieta-theme` 스코프 추가, `.dieta-app, .dieta-theme`에 동일 토큰과 다크 override 적용. 포털에도 box-sizing 적용.

- [ ] 먼저 다크 등록 음식 모달과 모바일 헤더 넘침을 재현·측정한다.
- [ ] 공통 테마, 데스크톱/모바일 내비와 폭을 구현하고 Dieta 전용 범위로 제한한다.
- [ ] label 연결, 선택 칩 aria-pressed, heading 계층과 주 콘텐츠 landmark를 확인·수정한다. 글로벌 main 중복 금지.
- [ ] 320/390/768/1440px에서 `scrollWidth <= clientWidth`, 키보드 focus, Escape/트랩/복귀, dark/light 모달과 버튼 대비를 검증한다.

### Task 2 — 홈의 정보 우선순위와 상태

**Files:** `frontend/src/pages/DietaHomePage.tsx`, `frontend/src/pages/DietaHomePage.test.tsx`, `frontend/src/components/dieta/DietaCharts.tsx`, dieta.css.
**Interfaces:** 기존 getProfile/listBodyLogs/listIntakes 및 필요 시 getMealQueue로 분석 대기 표시. 기존 saveWeight/applyWeekPlan/useDietaProposal 로직과 API 계약 유지.

- [ ] 기존 유지모드 전환 테스트를 보존하고, 조회 실패 재시도·무기록/실제 0·체크인 가능 상태의 행동 테스트를 추가한다.
- [ ] 기록 영역을 차트 위로 이동. 체크인 날짜에는 두 진입점이 같은 계획으로 이어짐을 명확히 표시한다.
- [ ] 최신 기록과 기간 변화, 전체 영양소 명칭, 기간별 빈 상태를 제공한다. meter 범위를 초과하는 값은 시각 수치와 접근성 값을 유효하게 구분한다.
- [ ] 기존 회귀 및 새 상태 테스트를 실행하고 390px에서 첫 작업 영역과 하단 고정 내비를 확인한다.

### Task 3 — 식사와 레시피 상태 정리

**Files:** `frontend/src/pages/DietaMealsPage.tsx`, `frontend/src/components/dieta/DietaRecipeLibraryModal.tsx`, `DietaRecipeModal.tsx`; 신규 `frontend/src/pages/DietaMealsPage.test.tsx`.
**Interfaces:** 기존 queue 상태/recipe.kind 및 addRecipeToDay/analyzeRecipe/finalize 사용. 레시피 생성만으로 섭취 합계가 증가하지 않음.

- [ ] empty/open/pending/failed/done, AI 미동의, 저장한 음식 추가와 레시피 보관의 차이를 테스트한다.
- [ ] 초기 refresh 실패를 별도 loadError와 재시도로 처리한다. profile/queue null을 미동의·빈 기록으로 표시하지 않는 테스트를 추가한다. 분석 실패와 조회 실패는 별도 상태다.
- [ ] 사용자 용어로 바꾸고 오늘 목록을 끼니별로 정돈한다. pending·failed·done 안내와 재시도는 해당 목록에 둔다.
- [ ] 확정 전에 ‘이후 한 줄 음식 추가 불가’를 알린다. 닫힌 날 레시피 추가 허용 여부는 기존 API 계약을 따라 별도로 표시한다.
- [ ] 긴 음식명/실패 문구/다수 기록을 mock으로 확인한다. 식사 화면 진입 시 기존 어제 자동 마감이 있으므로 브라우저 회귀는 가짜 API fixture 환경에서 한다.

### Task 4 — 첫 설정·설정 편집의 예측 가능성

**Files:** `frontend/src/pages/DietaOnboardingPage.tsx`, `DietaSettingsPage.tsx`; 각 페이지 신규 test.tsx, 필요 시 `frontend/src/features/dieta/utils/dietaMath.test.ts`.
**Interfaces:** completeOnboarding/updateProfile/setMaintainMode/resetAll 유지. 섹션별 local draft 및 save 상태; 저장 성공 시에만 기준 profile 갱신.

- [ ] 변경 후 취소, 유효하지 않은 입력, 저장 실패 후 draft 보존, 중복 저장 방지와 삭제 취소 시 API 미호출을 테스트한다.
- [ ] 온보딩 고급 항목을 접고 개인화 미리보기의 고정 2200을 제거한다. 기존 계산 helpers/서버 결과와 비교하는 테스트 없이 새 수치를 표시하지 않는다.
- [ ] 설정을 섹션별 저장/취소로 전환한다. 현재 BrowserRouter에는 data router 전용 useBlocker를 도입하지 않는다. 계정별 draft를 메모리에 보존해 앱 내 이동·뒤로가기 후 복귀 시 ‘저장하지 않은 변경’과 저장/취소를 보여주고, 새로고침·탭 닫기는 beforeunload 경고를 사용한다. 로그아웃/계정 변경 시 draft를 지운다. 유지 전환과 미저장 draft가 충돌하면 먼저 저장/취소 선택을 받는다. 해당 이동·복귀·계정 변경을 테스트한다.
- [ ] 데이터 삭제를 별도 영역으로 이동하고 제목·확인문·버튼에 삭제 효과를 동일하게 쓴다. 실제 계정으로 초기화를 시험하지 않는다.

### Task 5 — 활동·체크인·소개 카피

**Files:** `frontend/src/pages/DietaActivityPage.tsx`, `DietaCheckInPage.tsx`, `DietaLandingPage.tsx`, `frontend/src/components/dieta/DietaWeekPlanModal.tsx`; 활동/체크인 신규 test.tsx.
**Interfaces:** 기존 activity 목표 계산, 체크인 proposal/pending/error/revisionToken 유지. 소개는 HobbyLandingLayout 기존 props 사용.

- [ ] 활동 저장 실패/재시도, 미입력과 0, 체크인 불가/가능/완료, 제안 갱신 중 적용 불가를 테스트한다.
- [ ] CheckIn 초기 getProfile/listBodyLogs 실패 시 로딩을 종료하고 재시도 화면을 표시하는 테스트를 추가한다. 제안 생성 오류 처리와 구별한다.
- [ ] 활동 입력 우선과 대안 목표 문구, 체크인 현재/제안 비교, 이해 가능한 용어를 반영한다.
- [ ] 제안 입력 전에는 ‘체중을 입력하면 요약을 확인할 수 있어요’로 표시해 proposal 미생성을 실제 기록 없음으로 단정하지 않는다.
- [ ] 소개 카피와 화면 캡처를 최종 UI에 맞춘다. 공유 랜딩의 다른 서비스 디자인은 유지한다.

### Task 6 — 통합 검증·명세 갱신

**Files:** `docs/dieta/FEATURE_SPEC.md`, 신규 `frontend/e2e/dieta.spec.ts` 및 합성 데이터 fixtures.

- [ ] UI 구현을 독립 검토하고 유효한 결함 수정 후 영향받는 검사만 재실행한다.
- [ ] `frontend`에서 `npm run test -- src/pages/DietaHomePage.test.tsx src/pages/DietaMealsPage.test.tsx src/pages/DietaOnboardingPage.test.tsx src/pages/DietaSettingsPage.test.tsx src/pages/DietaActivityPage.test.tsx src/pages/DietaCheckInPage.test.tsx src/features/dieta/useDietaProposal.test.tsx src/features/dieta/utils/dietaMath.test.ts src/api/dietaMappers.test.ts` 실행. 실제 생성된 테스트 파일 기준으로 조정한다.
- [ ] `npm run lint`와 `npm run build`, `npm run test:e2e -- e2e/dieta.spec.ts` 실행. 실행 전 도구 설정의 dotenv/env 로딩을 확인하고 실제 환경 파일을 읽지 않는 격리 설정을 사용한다. 필요한 실제 비밀 설정 단계는 사용자가 실행한다.
- [ ] 320/390/768/1440px light/dark, 200% 확대, reduced-motion, 키보드 탐색, 모달 전환, 긴 목록/빈 목록/API 오류/재시도를 확인한다.
- [ ] 수치 저장·분석·제안 적용 테스트는 mock API 또는 명시적으로 지정된 테스트 계정에서만 수행. 실제 기록·계정 정보는 스크린샷 산출물에 넣지 않는다.
- [ ] FEATURE_SPEC의 네비 표시명·설정 저장 방식·첫 설정 설명을 최종 동작과 일치시킨다. 기능 계산·접근 제한은 바꾸지 않는다.

## 8. 완료 기준

- 홈에서 식사/체중 기록 동선을 차트보다 먼저 찾을 수 있다.
- 데스크톱 여백을 유용한 2열 구조로 사용하고 모바일에는 수평 스크롤이 없다.
- 모든 Dieta 모달은 본문과 같은 테마이며 정상 텍스트 4.5:1, 큰 글자/컨트롤 경계 3:1 대비를 충족한다.
- 현재 반영된 영양과 분석 대기 기록을 구분할 수 있다.
- 설정의 저장 시점·성공·실패를 알 수 있고 삭제 기능을 일반 수정으로 오해하지 않는다.
- 기존 체크인·유지 전환·중복 방지·레시피 계약을 회귀 테스트로 보존한다.
- 계획 단계에서는 앱 구현을 변경하지 않는다. 현재 수행된 검토와 향후 검증 항목을 구분해서 보고한다.

## 9. 계획 검토

- 독립 리뷰 실행 구성: `gpt-6-astra` / `high`. 부모 모델·effort는 노출되지 않아 미확인.
- 초기 조회 오류 범위를 식사/체크인까지 명시하고 BrowserRouter와 호환되는 미저장 draft 보존 방식으로 보완했다. 관련 코드를 직접 재확인했다.
- 문서 구조(6개 작업·완료 기준) 및 공백 검사 완료. 앱 코드 변경·테스트/빌드 실행은 이 계획 작업에 포함되지 않았다.
