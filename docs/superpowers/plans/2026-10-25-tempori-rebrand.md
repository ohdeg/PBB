# Tempori 제품명 일괄 변경 계획

**요청:** Scoreviewer를 Tempori로 바꾸고 관련 파일명·폴더·참조 전체에 적용한다.
**범위:** 기존 UI/UX 미커밋 작업을 보존한 상태에서 브랜드·소스 경로·CSS·URL·자산명·문서·테스트를 변경한다. 구현 담당은 한 명이며 별도 계획/코드 리뷰를 받는다.

## 결정 및 호환성
- 표시 이름 `Tempori`, 코드 접두어 `Tempori`/`tempori`/`TEMPORI`, 기능 디렉터리 `frontend/src/features/tempori`.
- 제품 페이지 `TemporiLandingPage`, `TemporiPage`, `TemporiLibraryPage`; 루트 뷰어 `Tempori`.
- 기능 내부 Score 접두어 파일 및 대응 export/import/식별자는 Tempori 접두어로 변경한다. `OsmdViewer`, MusicXML 표준과 외부 OSMD/MuseScore API는 유지한다. 사용자 추가 요청에 따라 내부 `scoreId` → `temporiId`, `scores` → `temporiItems`, Score 타입·심볼도 모두 새 이름으로 바꾼다. 다른 앱의 점수(score) 계산은 범위 밖이다.
- canonical URL `/hobbies/tempori`, `/hobbies/tempori/library`, `/hobbies/tempori/:id`. 기존 `/hobbies/score-viewer` 하위 경로는 같은 suffix/query/hash를 유지해 replace 리다이렉트한다.
- 브랜드로 쓰이는 Score Viewer/Scoreviewer/TEMPO-FLOW는 Tempori로 교체한다. UI CSS 클래스의 score 접두어도 범위를 구분해 tempori로 변경한다.
- localStorage는 `tempori:` 네임스페이스, IndexedDB는 `tempori-local-library` / `tempori` store로 이전한다. 실제 기존 ID 값과 원본 데이터는 보존한다. 구 이름은 이전·리다이렉트 호환성 코드/테스트 및 역사 계획에만 남긴다. 아래 최신 마이그레이션 설계가 이전의 저장소 유지 결정보다 우선한다.
- 이미지 파일명과 경로를 변경한다. 제품 이미지에 포함된 구 브랜드 글자도 갱신하되 원본 화면 의미를 보존한다. 이 이미지 작업은 부모가 별도로 담당하며 소스 구현 담당은 파일 이동/참조를 담당한다.
- 기존 계획서와 README/흐름 문서/SEO/사이트맵/robots/E2E 참조도 새 이름 및 새 경로로 갱신한다. 과거 Git 이력과 ignored/secret 파일은 수정하지 않는다.

## 단계
1. [x] 허용된 파일 목록과 참조 조사; 계획 검토; 이름 매핑 결정.
2. [x] rename 회귀 테스트 작성: 새 route/link/asset/import, 기존 URL suffix/query/hash 보존, 기존 데이터의 새 저장소 이전·충돌·실패 후 재시도.
3. [x] 기능 폴더·페이지·Score 접두어 모듈·테스트·관련 자산·문서를 이동하고 import/export와 CSS 참조를 일괄 갱신.
4. [x] 신규 canonical route/SEO와 legacy redirect, storage 상수 경계 적용.
5. [x] 구 브랜드 잔존 검색, 상대 import/자산 경로 검사, 허용 Node 테스트, diff 검사. 독립 코드 리뷰 지적 수정 및 관련 검증 재실행.

## 접근 경계와 검증
- .gitignore 적용 ignored 경로와 실제 .env/secret 파일을 읽거나 실행하지 않는다. node_modules/dist/build/test-results/coverage/.venv 접근 금지 유지.
- 경로 스캔은 git 파일 목록 또는 명시적으로 허용된 디렉터리를 사용하고 한글 분해형 학습데이터 폴더도 탐색하지 않는다.
- 신규 경로는 git check-ignore 및 hook snapshot 갱신 후 접근한다. 정책 stale/changed 보고가 있으면 중단하고 재시작 안내.
- 시스템 Node 내장 테스트 및 TypeScript strip 검증만 실행 가능한 범위로 기록한다. Vitest/전체 타입/빌드/실브라우저 검증은 현 정책에서 실행하지 않으며 성공 주장하지 않는다.
- 기존 UI/UX 수정과 iOS 파일 선택 변경을 보존한다. 환경변수 변경, dependency 설치, 커밋, 배포 없음.

## 완료 기준
- 허용 소스·문서·파일 경로에서 구 제품명은 호환성 경계 외에 남지 않는다.
- 새 제품 링크·lazy import·스타일·asset 및 테스트 참조가 모두 실제 새 경로와 일치한다.
- 구 링크로도 동일 악보 접근이 가능하고 기존 데이터와 ID 값이 보존되고 새 저장소에서 조회된다.
- 코드/이미지 변경, 수행한 검증, 검증 제한을 최종 보고한다.

## 최초 계획 리뷰 (사용자 범위 확대 전의 역사 기록)
- `gpt-6-astra` / `high` 독립 계획 리뷰 후 구현 가능 판정. 다음 구체 기준을 추가했다.
- 호환성 상수는 `tempoflow:guest-user-id`, DB 이름/version/store/index, `local-` ID prefix, annotation prefix, preference/guide key, 이전 migration prefix/flag의 실제 값을 모두 보존한다. guest identity·annotation 읽기 회귀를 검증한다.
- legacy URL은 raw location.pathname의 구 prefix 뒤 suffix와 search/hash를 그대로 이어 붙인다. decode/re-encode하지 않는다. base/trailing slash/library/ID/encoded suffix/query/hash 및 replace navigation을 검증한다. 구 이름은 redirect 호환성 경계에도 허용한다.
- hobby registry ID, SEO metadata, E2E expectations, Vitest coverage 경로, 이미지 query string, CSS 테스트 selector, 문서 링크까지 검색 대상에 포함한다.
- 구현 전 lowercase/camelCase 파일을 포함한 rename 매핑을 기록한다. persisted schema와 scoreId 등 음악 도메인 필드는 유지한다.

## 구현 이름 매핑 (이동 전 확정)

- `frontend/src/features/score` → `frontend/src/features/tempori`
- `frontend/src/features/score/ScoreViewer.test.tsx` → `frontend/src/features/tempori/Tempori.test.tsx`
- `frontend/src/features/score/ScoreViewer.tsx` → `frontend/src/features/tempori/Tempori.tsx`
- `frontend/src/features/score/components/ScoreAnnotationLayer.tsx` → `frontend/src/features/tempori/components/TemporiAnnotationLayer.tsx`
- `frontend/src/features/score/components/ScoreAnnotationToolbar.tsx` → `frontend/src/features/tempori/components/TemporiAnnotationToolbar.tsx`
- `frontend/src/features/score/components/ScoreAutoScroller.tsx` → `frontend/src/features/tempori/components/TemporiAutoScroller.tsx`
- `frontend/src/features/score/components/ScoreDeleteConfirm.tsx` → `frontend/src/features/tempori/components/TemporiDeleteConfirm.tsx`
- `frontend/src/features/score/components/ScoreMeasureClickOverlay.test.tsx` → `frontend/src/features/tempori/components/TemporiMeasureClickOverlay.test.tsx`
- `frontend/src/features/score/components/ScoreMeasureClickOverlay.tsx` → `frontend/src/features/tempori/components/TemporiMeasureClickOverlay.tsx`
- `frontend/src/features/score/components/ScoreMetronome.tsx` → `frontend/src/features/tempori/components/TemporiMetronome.tsx`
- `frontend/src/features/score/components/ScoreNumberInput.tsx` → `frontend/src/features/tempori/components/TemporiNumberInput.tsx`
- `frontend/src/features/score/components/ScorePositionHighlight.tsx` → `frontend/src/features/tempori/components/TemporiPositionHighlight.tsx`
- `frontend/src/features/score/components/ScoreUploadConfirm.test.tsx` → `frontend/src/features/tempori/components/TemporiUploadConfirm.test.tsx`
- `frontend/src/features/score/components/ScoreUploadConfirm.tsx` → `frontend/src/features/tempori/components/TemporiUploadConfirm.tsx`
- `frontend/src/features/score/constants/scoreLayout.ts` → `frontend/src/features/tempori/constants/temporiLayout.ts`
- `frontend/src/features/score/hooks/useScorePlaybackController.ts` → `frontend/src/features/tempori/hooks/useTemporiPlaybackController.ts`
- `frontend/src/features/score/hooks/useScorePlaybackDerived.test.tsx` → `frontend/src/features/tempori/hooks/useTemporiPlaybackDerived.test.tsx`
- `frontend/src/features/score/hooks/useScorePlaybackDerived.ts` → `frontend/src/features/tempori/hooks/useTemporiPlaybackDerived.ts`
- `frontend/src/features/score/services/scoreRepository.ts` → `frontend/src/features/tempori/services/temporiRepository.ts`
- `frontend/src/features/score/store/scorePlaybackStore.ts` → `frontend/src/features/tempori/store/temporiPlaybackStore.ts`
- `frontend/src/features/score/types/scoreAnnotation.ts` → `frontend/src/features/tempori/types/temporiAnnotation.ts`
- `frontend/src/features/score/types/scorePractice.ts` → `frontend/src/features/tempori/types/temporiPractice.ts`
- `frontend/src/features/score/utils/localScores.ts` → `frontend/src/features/tempori/utils/localTempori.ts`
- `frontend/src/features/score/utils/migrateMusicViewerStorage.ts` → `frontend/src/features/tempori/utils/migrateTemporiStorage.ts`
- `frontend/src/features/score/utils/scoreAnnotations.ts` → `frontend/src/features/tempori/utils/temporiAnnotations.ts`
- `frontend/src/features/score/utils/scoreLoader.ts` → `frontend/src/features/tempori/utils/temporiLoader.ts`
- `frontend/src/features/score/utils/scoreSearch.ts` → `frontend/src/features/tempori/utils/temporiSearch.ts`
- `frontend/src/pages/ScoreViewerLandingPage.tsx` → `frontend/src/pages/TemporiLandingPage.tsx`
- `frontend/src/pages/ScoreViewerPage.tsx` → `frontend/src/pages/TemporiPage.tsx`
- `frontend/src/pages/ScoreViewerPage.test.tsx` → `frontend/src/pages/TemporiPage.test.tsx`
- `frontend/src/pages/ScoreLibraryPage.tsx` → `frontend/src/pages/TemporiLibraryPage.tsx`
- `frontend/tests/scorePractice.node-test.mjs` → `frontend/tests/temporiPractice.node-test.mjs`
- `frontend/public/hobbies/score-viewer-product.png` → `frontend/public/hobbies/tempori-product.png`
- `frontend/public/hobbies/score-viewer-product-dark.png` → `frontend/public/hobbies/tempori-product-dark.png`
- `docs/screenshots/score-viewer.png` → `docs/screenshots/tempori.png`
- `docs/superpowers/plans/2026-10-25-scoreviewer-ux.md` → `docs/superpowers/plans/2026-10-25-tempori-ux.md`

- 대응 컴포넌트/훅/store/type export/import 및 내부 식별자도 Tempori로 변경한다. `ScoreDetail` → `TemporiDetail`, `ScoreSummary` → `TemporiSummary`, `LibraryScoreItem` → `LibraryTemporiItem`, `scoreId` → `temporiId`. MusicXML `score-partwise` 및 외부 API는 보존한다.
- `temporiStorage.ts`에 현재 지속 저장 식별자를, `legacyStorage.ts`에 읽기 전용 이전 원본 식별자를 모은다.
- 기존 CSS `score-*`는 이 기능에 속하는 사용처·정의만 `tempori-*`로 바꾸며 다른 기능의 score 계산은 그대로 둔다.


## 최신 저장소 이전 설계 (2026-10-25 사용자 추가 요청)

**수용 기준:** 기존 identity·설정·annotation·파일 ArrayBuffer·메타데이터가 새 Tempori 저장소에서 보인다. 원본 삭제 없음, 대상 충돌은 대상 우선, 실패는 재시도 가능, 성공 전에는 새 identity 생성이나 기능의 저장소 읽기/쓰기 없음.

1. 현재 상수: guest `tempori:guest-user-id`, annotation `tempori:annotations:`, preference `tempori:last-bpm`, `tempori:last-measures-per-line`, `tempori:annotation-brush-sizes`, `tempori:auto-scroll-mode`, guide `tempori:guide:tempori-seen`, 완료 flag `tempori:storage-migrated-v1`; DB `tempori-local-library`, version 1, store `tempori`, key `id`, generic indexes `userId`/`createdAt`. 새 ID는 `tempori-UUID`; 기존 `local-...` ID 값도 계속 허용한다.
2. 원본 우선순위는 기존 `score-viewer:` 설정/annotation 및 `score-viewer-local-scores` DB 먼저, 오래된 `music-viewer:` / `music-viewer-local-scores` 다음. 새로운 score-viewer store가 없고 기존 score-viewer 완료 flag도 1이 아닌 경우에만 오래된 music-viewer를 자동 이전한다. store가 존재하면 비어 있어도 최신 스냅샷으로 간주하며 설정·annotation에도 같은 조건을 적용한다. `tempoflow:guest-user-id`를 새 키로 복사하되 대상 값이 있으면 유지한다. 두 guide suffix는 새 guide 키로 매핑하고 과거 migration flag는 복사하지 않는다. 명시적 키와 annotation만 이전하여 임의 사용자 JSON의 필드명/문자열은 변형하지 않는다.
3. 기존 실제 IDB 레코드는 `id`, `userId`, title/artist/fileName/mimeType/fileData/createdAt이며 `scoreId`/`scores` 필드가 없다. store 이름만 `scores` → `tempori`로 바꾸고 파일 및 메타데이터를 그대로 복사한다. 원본 owner가 기존 guest identity이고 대상 guest가 이미 다르면 복사본 owner만 대상 guest로 연결하여 숨겨진 라이브러리가 생기지 않게 한다. 다른 owner는 보존한다.
4. localStorage는 absent 대상에만 복사. IDB는 각 source read transaction 완료 후 대상 readwrite transaction 안에서 key 조회→없는 경우 add하여 충돌 원자성 확보; target row는 절대 덮어쓰지 않는다. transaction 완료 후만 성공 처리한다. legacy DB가 없어서 upgrade 이벤트가 발생하면 transaction abort하여 빈 구 DB를 만들지 않는다. open/read/write/abort/blocked 오류는 실패 처리하고 핸들을 닫는다.
5. 단일 진행 Promise를 공유하고 실패 시 캐시를 비운다. 완료 flag는 localStorage 복사와 두 IDB 복사가 모두 성공한 뒤 기록한다. 부분 성공 후 재시도는 absent 대상만 추가한다. 성공 flag 후에는 이전 원본을 다시 가져오지 않아 사용자가 삭제한 새 데이터가 복원되지 않는다.
6. eager `TemporiStorageBoundary` route가 migration await 후에만 `Outlet`을 렌더링하여 lazy 페이지/모듈의 설정 읽기 전에 완료된다. 실패 시 접근을 보류하고 오류/다시 시도 UI를 제공한다. repo 비동기 entrypoint에도 await를 넣어 route 외 호출 보호. 기존 fire-and-forget migration 호출 제거.
7. 테스트: fresh install, 구 두 브랜드 이전, 새 데이터 충돌 보존, guest 충돌 owner 연결, annotation·ID 유지, legacy DB 부재 abort, open/read/write/transaction abort/blocked 실패, 완료 flag 실패와 재시도, concurrent calls, 완료 후 재이전 방지. dependency-free Node test와 필요한 최소 IDB 이벤트 adapter로 실제 migration 로직 검증. route suffix/query/hash와 정적 import/asset 경로도 검증.

## 실행 기록
- 현재 접근 경계와 사용자 수정 상태 확인. 전체 타입/빌드/실브라우저 검증은 ignored 의존성 접근 금지로 실행하지 않는다.
- 구현 전에 확대된 계획의 독립 검토를 받는다. 한 명의 owner가 순차 구현하며 커밋·배포·환경변수 변경 없음.

- 확대 계획 독립 리뷰 완료: 최신 store 또는 과거 완료 flag가 있으면 오래된 원본 재수입 금지. 과거 flag 조기 기록 때문에 누락과 사용자 삭제를 구분할 수 없어 오래된 원본은 자동 복구하지 않고 보존한다. 빈 최신 store 및 flag 뒤 삭제를 회귀 검증한다.


## 구현 및 검증 기록
- feature/page/type/hook/store/service/utility/test/CSS/i18n/route/SEO/robots/sitemap/README/흐름도 이름·참조 변경. MusicXML 표준과 MuseScore/PlayScore 외부 이름은 보존했다.
- 현재 저장소 이름과 이전 원본 상수 분리, 비파괴 이전, 기존 ID 값 유지 및 새 `tempori-` ID 적용. 실제 .env/ignored 의존성 접근 및 환경변수 변경 없음.
- 공개 랜딩은 저장소를 사용하지 않으므로 migration 경계 밖에 둔다. 보관함/뷰어의 lazy 모듈은 이전 성공 후에만 로드된다. 기존 fire-and-forget 이전은 제거했다.
- 부모가 준비한 새 브랜드 이미지 3개를 참조한다. 기존 이미지 이름은 제거했으며 README는 브랜드명 편집 이미지임을 표시한다. 실제 브라우저 검증 자료로 간주하지 않는다.
- `node --import ./frontend/tests/registerTypeScript.mjs --test frontend/tests/*.node-test.mjs`: 30/30 통과. 기존 키에만 쓰는 코드를 대상으로 새 Tempori 키 검사 2개 실패 확인 후 구현했다. 파일 저장 transaction 완료/abort 회귀 2개, 독립 migration 인스턴스 지연 후 삭제 복원 방지 2개도 각각 실패 확인 후 수정하고 전체 재검증했다.
- migration: 기존 guest/선호/annotation/파일 bytes, 대상 충돌, guest 충돌 연결, 새 설치, 구 소스 부재 abort, 과거 완료·빈 최신 store에 의한 fallback 억제, open/read/write/commit/blocked 실패·재시도, 완료 flag quota 실패, 독립 인스턴스 race를 검사했다. Node의 이벤트 수준 IndexedDB 대역을 사용한 검증으로 실제 브라우저 IndexedDB 검증을 대신했다고 주장하지 않는다.
- 구현 담당 정적 검사: TypeScript `.ts` 43개 문법 strip 성공(타입 검사 아님), 실제 i18n literal 참조 210개 모두 존재, `git diff --check` 통과. 잔존 구 제품명은 legacy storage/redirect 경계에만 남는다.
- 부모 독립 검사: 소스/e2e/Node 파일 297개, 상대 import 835개에서 누락 0개; 대상 이미지 3개 존재; 같은 Node 테스트 28개까지 별도 실행 통과 (race 수정 후 전체 30개 재검증은 구현 담당 수행).
- 독립 코드 리뷰 지적: 삭제된 migration import 제거, 보통 파일 저장의 transaction 완료 대기/abort 처리, 다른 migration 인스턴스가 완료한 뒤 삭제된 데이터를 복원하는 race 수정. 각 수정 뒤 영향 범위를 재검증했고 최종 독립 재리뷰에서 중요 잔여 지적 없음 확인.
- 검증 제한: ignored 의존성 접근 금지로 전체 Vitest/TypeScript typecheck/Vite build/lint/실브라우저·반응형 검증을 실행하지 않았다. Node 내장 parser의 ExperimentalWarning 외 테스트 오류 없음.

- 최종 부모 및 독립 리뷰어 재검증: 전체 Node 30/30 통과, diff whitespace 검사 통과, 상대 import 835개 누락 없음, 구 filename 잔존 없음. 구현 담당 및 독립 리뷰 모델/effort는 부모가 실제 실행 설정으로 확인한 결과를 따른다. 이 문서의 모델 선호표만으로 실제 실행 모델을 단정하지 않는다.
- 최종 한계: 과거 migration 완료 flag 또는 최신 store가 존재하면 오래된 원본은 자동 복구하지 않는다. 과거 flag의 조기 기록 때문에 실패와 삭제를 구분할 수 없으며, 원본을 보존하여 필요시 명시적으로 복구할 수 있게 한다. 브라우저 네이티브 다중 탭 스케줄링/DOMException getter/TSX 번들 실행은 이번 허용된 검증 범위 밖이다.
