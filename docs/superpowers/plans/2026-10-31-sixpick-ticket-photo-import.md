# 6PICK 로또 용지 사진 등록 구현 계획서

> **실행 안내:** 구현 시 `executing-plans`를 적용한다. 한 구현 담당자가 순차 실행하고, 의미 있는 동작은 테스트부터 작성한다. 구현 전 계획 리뷰, 구현 후 실제 diff 기반 코드 리뷰와 재검증을 진행한다. 이 문서는 계획이며 구현·테스트 완료 보고가 아니다.

**Goal:** 구매한 로또 6/45 용지를 촬영하거나 사진으로 선택해 회차와 각 줄의 번호를 인식하고, 사용자 확인 후 기존 번호 내역에 저장한다.

**Architecture:** 브라우저의 Web Worker에서 Tesseract.js로 OCR을 수행한다. 이미지 전처리 → OCR 결과 파싱 → 사용자 수정·확인 → 기존 `useLottoHistory` 저장·당첨 판정 흐름을 연결한다. 이미지 업로드 API와 원본 사진 저장소는 만들지 않는다.

**Tech Stack:** 기존 React 19 / TypeScript / Tailwind / Vitest / Playwright, 추가 Tesseract.js 및 해당 버전과 호환되는 한국어·영어 학습 데이터. 설치 시 버전을 확정하고 lockfile로 고정한다.

**Spec:** 이 대화에서 합의한 촬영·사진 선택, 회차 및 A~E 번호 인식, 수정 후 선택 저장, 기존 두 탭과 당첨 알림 연계 요구사항. 구체적인 첫 버전 범위와 수용 기준은 아래에 정의한다.

## 1. 첫 버전 범위와 원칙

- 로또 6/45 발권 용지 한 장, 한 번에 사진 한 장, 최대 A~E 다섯 줄을 처리한다. 여러 장 일괄 등록, 다른 복권, 손으로 마킹한 구매 신청 용지는 지원하지 않는다.
- `용지 등록` → `사진 촬영` 또는 `사진 선택` → 미리보기·회전·영역 선택 → `번호 인식` → 회차·각 줄 수정 및 확인 → `확인한 번호 저장` 순서다.
- 사진은 브라우저 메모리에서만 사용한다. 서버·R2·Redis·로컬스토리지·IndexedDB에 원본, 축소본, OCR 원문을 저장하지 않는다. 학습 데이터 캐시는 사진 캐시와 구분한다.
- 확실히 읽지 못한 숫자는 빈칸과 `확인 필요`로 표시한다. 현재 회차나 비슷한 숫자로 자동 보정하지 않는다. 사용자 확인 없이 저장하지 않는다.
- JPEG / PNG / WebP, 파일당 15 MiB 이하, 디코딩 이미지 2,500만 픽셀 이하를 지원한다. HEIC 등 미지원 형식은 JPEG 변환 또는 수동 입력을 안내한다. 확장자만으로 판정하지 않는다.
- 회차는 양의 안전한 정수, 한 줄은 서로 다른 1~45 정수 여섯 개여야 한다. 확인된 최신 회차가 있으면 최신+1을 넘는 회차는 수정하도록 안내한다. 회차 목록을 못 불러왔으면 저장을 잠시 막고 재시도를 제공한다.
- 인식 회차가 결과 목록에 없어도 과거 회차라는 이유만으로 미당첨 처리하지 않는다. 완전한 결과가 없는 회차는 기존처럼 `결과 확인 대기`로 남긴다.
- 회차·번호 확인, 업로드 오류, 중복 안내는 일반 상태 메시지다. **당첨 알림에는 개수·등수·번호를 넣지 않는다.** 이번 주 알림은 `축하드립니다. 이번 주 당첨된 번호가 있습니다.`를 그대로 사용한다. 과거 회차는 기존 일반 당첨 문구를 사용한다.
- 기존 생성 번호, 당첨 보관함, 선택 삭제·이미지 내보내기, 로그인별 저장 방식은 유지한다.

## 2. 사용자 화면과 상태

### 진입과 사진 준비

- 기존 번호 내역 상단에 `용지 등록` 버튼을 추가한다. 기존 설정 화면 안에 숨기지 않는다.
- 모바일은 전체 높이에 가까운 다이얼로그, 데스크톱은 사진·번호를 나란히 볼 수 있는 다이얼로그를 사용한다. 기존 색·글꼴·번호 공 디자인을 유지한다.
- `사진 촬영`은 후면 카메라 힌트를 준 파일 입력, `사진 선택`은 일반 파일 입력으로 분리한다. 촬영 UI 지원 여부는 브라우저에 따라 달라지므로 사진 선택과 수동 입력을 항상 제공한다.
- 미리보기에서 90도 단위 회전, 사각형 영역 선택, `전체 사진 사용`, 다시 선택을 제공한다. 자동 원근 보정은 첫 버전에서 제외한다. 번호와 회차를 포함하도록 촬영 예시와 짧은 안내를 제공한다.
- 영역 조작은 드래그 외에 키보드로 경계를 조정할 수 있게 한다. 취소·닫기 시 자원과 임시 데이터를 해제한다.

### 인식과 확인

- 상태: `selecting → preparing → recognizing → reviewing → submitting → submitted` 및 `error`. 준비·인식은 취소 가능하다.
- OCR 모듈과 학습 데이터는 버튼 진입 이후 필요할 때 로드한다. 첫 실행은 `인식 도구 준비 중`, 인식 중은 `번호를 읽는 중`으로 구분한다. 완료 시간이나 정확도를 보장하는 수치는 표시하지 않는다.
- 회차 입력 한 개, A~E 줄마다 선택 체크박스·숫자 여섯 칸·`확인 완료`를 제공한다. 인식이 전혀 안 되어도 사용자가 줄을 추가해 수동 입력할 수 있다.
- 인식 결과가 유효해도 `확인 완료` 전에는 저장할 수 없다. 숫자나 회차를 수정하면 해당 확인 상태를 해제한다. 회차 변경은 모든 줄의 확인을 해제한다.
- 불완전한 줄은 기본 선택하지 않는다. 선택하지 않은 줄의 오류는 다른 정상 줄의 저장을 막지 않는다. 부분 인식은 정상 줄과 함께 보여주며 사진에서 재확인할 수 있게 한다.
- 선택된 줄이 없거나, 선택된 줄에 오류·미확인 항목이 있으면 저장을 막고 해당 위치로 안내한다.
- 같은 회차·같은 번호 조합이 기존 내역 또는 현재 입력 안에 있으면 `같은 번호가 이미 있습니다`와 함께 제외/의도적 중복 저장을 선택하게 한다. 같은 조합의 실제 용지를 여러 장 살 수 있으므로 자동 제거하지 않는다.

### 저장과 결과

- 아직 추첨 전이면 `이번 회차` 탭에 저장한다. 과거 회차의 미발표·불완전 결과는 같은 탭에 `결과 확인 대기`로 표시한다.
- 완전한 결과가 있는 회차는 확인 화면에서 줄별 결과를 미리 보여준다. `추첨이 끝난 회차입니다. 당첨 번호만 보관되며 미당첨 번호는 저장되지 않습니다.`를 저장 전에 표시한다.
- 과거 회차의 당첨 줄은 `당첨 보관함`에 저장한다. 미당첨 줄만 선택했다면 `선택한 번호는 미당첨으로 보관되지 않습니다`를 표시하고 불필요한 빈 저장 요청은 보내지 않는다.
- 사진 확인 중 회차 결과가 갱신되면 저장 직전에 최신 데이터로 다시 계산한다. 미리보기와 달라졌으면 결과·안내를 갱신하고 다시 확인받는다. 사용자 확인과 다른 삭제 결과를 조용히 적용하지 않는다.
- 저장 버튼의 중복 클릭을 막는다. 로그인 사용자는 서버 저장 확인 뒤에 완료를 표시한다. 실패 시 `아직 저장되지 않았습니다`와 재시도를 제공하고 같은 번호를 다시 append하지 않는다.
- 비로그인 저장은 기존 게스트 정책을 유지하며 `이 화면에서만 유지되며 새로고침하면 사라집니다`를 확인 전에 안내한다. 로그인 후 자동 이관은 추가하지 않는다.
- 완료 후 원본은 해제한다. 당첨만 있으면 보관함, 대기 번호가 있으면 이번 회차 탭을 연다. 완료 메시지는 `번호를 저장했습니다`이며 당첨 수를 노출하지 않는다.

## 3. 인식 방식과 정확도 검증

브라우저 OCR을 기본으로 선택한다. 별도 유료 OCR 계정과 서버 업로드 없이 시작할 수 있지만, 구겨짐·반사·기울어진 영수증에서 정확도가 충분한지는 실제 표본으로 확인해야 한다. 공식 문서는 브라우저 Worker 실행과 worker/core/언어 데이터 경로 지정을 지원한다.

1. 사진의 방향을 반영하고 사용자 회전·영역을 적용한다. OCR 입력의 긴 변을 최대 2,048px로 줄인다. 대비 보정·회색조 버전은 원본 축소본에서 만든다.
2. 한국어·영어 데이터로 회차와 줄 위치를 읽는다. OCR에서 텍스트와 블록/단어 위치를 명시적으로 요청한다. 용지 외곽의 날짜·금액·일련번호를 번호 줄로 사용하지 않는다.
3. `제 N 회` / `N회` 형태의 회차를 찾고, A~E 줄 표식 또는 검증 가능한 번호 행의 위치로 각 줄을 분리한다. 서로 다른 행의 숫자를 합쳐 여섯 개를 채우지 않는다. 행 구조가 불확실하면 수동 입력으로 넘긴다.
4. 번호는 원문 토큰 단위로 읽는다. `010203`을 임의로 `01 02 03`으로 나누거나 O→0, I→1 등을 묵시적으로 치환하지 않는다. 금액·날짜·QR·바코드 영역은 제외한다.
5. 첫 결과가 불완전하면 대비 보정본으로 한 번만 재시도한다. 두 결과가 다르면 한쪽을 정답으로 고르지 않고 해당 줄을 확인 필요로 표시한다. 한 이미지당 전체 OCR 시도는 최대 두 번이다.
6. 한 Worker만 운용하고, 45초 제한 또는 사용자 취소 시 terminate한다. 닫기·사진 교체·계정 전환 때도 terminate하고 늦게 끝난 결과를 무시한다.

### 출시 전 품질 기준

- 민감한 식별 부분이 제거된 **허가된 테스트 용지 20장 이상**으로 검증한다. 실제 구매 용지나 개인 정보가 담긴 원본을 임의로 읽거나 저장소에 커밋하지 않는다.
- 정면·선명 사진 10장 이상에서 회차와 모든 번호 행이 수정 없이 정확하게 인식된 사진 비율 90% 이상을 목표로 한다. 이 수치는 목표이며 현재 달성했다는 의미가 아니다.
- 반사·흐림·일부 잘림·회전·금액/날짜 혼동 사례에서 잘못 읽은 결과가 검증·사용자 확인을 거치지 않고 저장되는 경우는 0건이어야 한다. 유효한 숫자로 잘못 읽히는 경우도 있으므로 모든 줄의 사용자 확인을 유지한다.
- 목표 미달이면 자동 인식 기능을 출시 완료로 처리하지 않는다. 표본 분석 후 로컬 전처리 개선 또는 외부 OCR 도입의 비용·사진 전송 정책을 별도로 검토한다. 외부 전송 방식으로 조용히 변경하지 않는다.
- 실제 iOS Safari / Android Chrome에서 첫 로드·재인식 시간과 메모리 문제를 측정하고 기록한다. 모델 준비 실패나 저사양 기기에서도 수동 입력은 동작해야 한다.

## 4. 저장 구조와 인터페이스

기존 `lotto_user_picks.items` JSON 및 `/api/v1/lotto/picks` GET/PUT을 재사용한다. 새 테이블·컬럼·Redis 키·사진 URL은 추가하지 않는다. 기존 서버의 JSON 200,000자 한도와 오류·재시도 안내를 유지한다.

`LottoHistoryItem`에 다음 선택 필드를 추가한다. 기존 레코드는 필드 없이 읽혀야 한다.

```ts
source?: 'generated' | 'ticket-photo';
ticketLine?: 'A' | 'B' | 'C' | 'D' | 'E';
registeredAt?: string; // ISO 시각, 구매/추첨 시각으로 표시하지 않음
```

기존 `targetRound`, `numbers`, `status`, `prizeRank`, `winAcknowledged`를 사용한다. 사진 등록 항목의 `drawnAt`을 촬영 시각으로 채우지 않는다. 표시 제목은 `용지 등록 · A`처럼 만들고 기존 필수 메타 필드도 채운다. 출처·등록 시각은 화면과 이미지 내보내기에 같은 의미로 표시한다.

프런트 내부 계약:

```ts
type TicketLine = 'A' | 'B' | 'C' | 'D' | 'E';
type TicketOcrDraft = {
  detectedRound: number | null;
  rows: { line: TicketLine; values: (number | null)[]; needsReview: boolean }[];
  warnings: string[];
};
type ConfirmedTicket = {
  targetRound: number;
  rows: { line: TicketLine; numbers: number[] }[];
};
type TicketImportPreview = {
  waiting: number;
  won: number;
  discarded: number;
  fingerprint: string; // 선택 내용과 관련된 완전한 결과로 만드는 내부 비교값
};
```

- `prepareTicketImage(file, { rotation, crop }, signal): Promise<PreparedTicketImage>`: 처리된 이미지와 해제 함수를 반환한다. 타입은 같은 파일에 정의한다.
- `recognizeTicket(image, { signal, onProgress }): Promise<TicketOcrDraft>`: 사진을 영속화하지 않는다. OCR 원문을 UI나 로그에 노출하지 않는다.
- `parseLottoTicket(blocks): TicketOcrDraft`: 라이브러리와 분리된 순수 함수. blocks는 어댑터에서 자체 행·단어·사각형 타입으로 정규화한다.
- `validateTicketDraft(draft, selectedLines, confirmedLines, latestRound): ValidationResult`: 선택된 줄의 회차·숫자·확인 상태·중복 안내 필요 여부를 반환한다. 타입은 `types/ticketImport.ts`에 함께 정의한다.
- `previewTicketImport(ticket, draws): TicketImportPreview`: 기존 등수 판정 로직을 공유해 대기·당첨·제외 결과를 계산한다. 별도 등수 계산은 만들지 않는다.
- `buildTicketHistoryItems(ticket, ids, registeredAt): LottoHistoryItem[]`: 사진·OCR 원문·회원 정보를 포함하지 않는다.
- `allocateLottoHistoryIds(count, existingIds): number[]`: 기존 생성과 사진 등록에 공통으로 적용한다. Date.now() 기준 단조 증가 안전 정수이며 기존 ID·동시 배치와 충돌하지 않는다. 기존 number ID는 유지한다.
- 저장 hook에 `appendAndWait(items, { operationId, expectedOwner }): Promise<'saved' | 'local'>`을 추가한다. 같은 operationId 재시도는 다시 추가하지 않고 기존 직렬 PUT·revision 확인에 연결한다. 실패는 reject하며 이미 추가한 로컬 데이터는 기존 retry로 전송한다. 기존 append는 호환 유지한다.
- 부모 페이지는 소유자 epoch와 등록 세션 ID를 보유한다. 로그아웃·계정 변경·A→B→A는 등록을 닫고 폐기한다. 토큰 갱신만으로 닫지 않는다. 종료된 작업의 완료가 새 등록 화면에 영향을 주지 않아야 한다.

## 5. 변경 파일과 구현 순서

### Task 1: OCR 실증과 로컬 배포

**신규:** `frontend/src/features/lotto/services/ticketOcr.ts`, `frontend/scripts/prepare-lotto-ocr-assets.mjs`, `frontend/public/ocr/README.md`, `frontend/src/features/lotto/services/ticketOcr.test.ts`

**변경:** `frontend/package.json`, `frontend/package-lock.json`

- [ ] Worker 초기화 실패, 45초 제한, 취소, 늦은 응답 폐기, 최대 두 번 인식의 테스트를 먼저 작성하고 실패를 확인한다.
- [ ] Tesseract.js를 지연 import하고, 한국어·영어 모델, Worker·WASM을 동일 출처에서 제공한다. 기본 CDN으로 자동 전환하지 않는다. 준비 스크립트는 버전과 체크섬이 고정된 공개 자산만 취급한다. 비밀 설정을 읽지 않고 라이선스·출처를 README에 기록한다.
- [ ] `prepare:lotto-ocr`를 개발 서버·빌드 전에 실행하도록 구성한다. `public/ocr/`에 공개 정적 파일을 생성한다. 생성물은 Git에서 제외하고 README는 추적하며, 잠금된 패키지와 체크섬 목록으로 재현한다. core 패키지가 요구하는 WASM 파일 전체를 복사한다.
- [ ] CSP, WASM MIME, 배포 경로, production build에서 파일 로드를 확인한다. 모델만 캐시하고 입력 사진은 캐시하지 않는다.
- [ ] 실증용 작은 실행 화면으로 앞의 품질 기준을 확인하고 채택 여부·기기별 측정치를 본 문서에 기록한다. mock 시험을 실제 사진 정확도 검증으로 보고하지 않는다. 실증 화면은 제품 배포에 포함하지 않는다.

### Task 2: 이미지 처리·파싱·입력 검증

**신규:** `frontend/src/features/lotto/utils/prepareTicketImage.ts`, `parseLottoTicket.ts`, `ticketImport.ts` 및 각각의 `.test.ts`

**신규 타입:** `frontend/src/features/lotto/types/ticketImport.ts`

- [ ] 회전, 범위를 벗어난 crop, 손상 이미지, 15MiB 초과, 픽셀 초과, 미지원 형식, 자원 해제 테스트를 작성하고 실패를 확인한다.
- [ ] 회차·A~E, 한 줄/다섯 줄, 중복 숫자, 0/46, 누락, 가격/날짜/일련번호, 행 혼합, 두 인식 결과 불일치를 합성 OCR fixture로 만든다. 개인 정보나 실제 영수증 원본은 넣지 않는다.
- [ ] 순수 함수와 전처리를 구현한다. crop과 회전 좌표 변환은 한곳에서 관리해 확인 사진과 인식 대상이 일치하게 한다. 회차가 여러 개 검출되면 임의 선택하지 않는다.
- [ ] 선택한 줄만 검증하고 미확인·회차 누락은 저장을 막는다. 결과 미확정은 대기로 유지하며, fingerprint는 관련 회차의 본번호·보너스 변경을 감지하고 무관한 회차 추가에는 바뀌지 않도록 테스트한다.
- [ ] frontend에서 `npm test -- src/features/lotto/utils/prepareTicketImage.test.ts src/features/lotto/utils/parseLottoTicket.test.ts src/features/lotto/utils/ticketImport.test.ts src/features/lotto/services/ticketOcr.test.ts`를 실행해 전체 PASS를 확인한다.

### Task 3: 안전한 내역 추가와 저장

**변경:** `frontend/src/types/lotto.ts`, `frontend/src/features/lotto/hooks/useLottoHistory.ts`와 기존 테스트, `frontend/src/features/lotto/utils/lottoHistory.ts`와 기존 테스트, `frontend/src/pages/LottoPage.tsx`의 기존 생성 ID 할당 부분

**신규:** `frontend/src/features/lotto/utils/lottoHistoryIds.ts` 및 테스트

- [ ] 동시 생성·사진 등록의 ID 충돌, 시계 역행, 기존 ID, 같은 operationId 재시도, PUT 실패 후 재시도, 이전 PUT 중 추가, 계정 전환, 취소 후 완료에 대한 실패 테스트를 먼저 추가한다.
- [ ] 기존 hook을 확장하고 operationId는 소유자 세션 동안만 관리한다. 해당 revision이 서버에 저장돼야 성공을 반환하며, 다른 owner나 abort 뒤 성공 처리하지 않는다. 사진 등록 전용 PUT 루프는 만들지 않는다. 내역 초기 로드 완료 전에는 사진 저장을 막는다.
- [ ] 등수 판정 순수 로직을 공유해 과거 당첨 보관·과거 미당첨 제외·미확정 대기를 유지한다. 확인 후 결과가 바뀌면 append 전에 확인 화면으로 돌아간다.
- [ ] source 등 새 메타데이터가 migration·판정·API 왕복 후 보존되고, 기존 필드 없는 내역도 읽히는지 테스트한다.
- [ ] frontend에서 `npm test -- src/features/lotto/hooks/useLottoHistory.test.tsx src/features/lotto/utils/lottoHistory.test.ts src/features/lotto/utils/lottoHistoryIds.test.ts src/api/lottoApi.test.ts src/api/lottoApi.ownerCancellation.test.tsx`를 실행해 전체 PASS를 확인한다.

### Task 4: 촬영·확인 UI와 기존 페이지 연결

**신규:** `frontend/src/features/lotto/components/LottoTicketImportDialog.tsx`, `LottoTicketImageEditor.tsx`, `LottoTicketReview.tsx`, `frontend/src/features/lotto/hooks/useLottoTicketImport.ts` 및 대응 테스트

**변경:** `frontend/src/pages/LottoPage.tsx`, `frontend/src/features/lotto/components/LottoHistoryPanel.tsx`와 기존 테스트, `frontend/src/pages/LottoPage.history.test.tsx`

- [ ] 기존 화면을 web-design-guidelines→frontend-design 순서로 확인하고 스타일·정보 계층을 유지한다.
- [ ] 사진 선택/취소, 회차 수정 후 확인 해제, 정상 줄만 저장, 의도적 중복 저장, 과거 미당첨 사전 안내, 통신 실패 후 같은 내용 재시도, 게스트 안내를 컴포넌트 테스트로 고정한다.
- [ ] 포커스 가두기·Escape·닫은 뒤 포커스 복귀, 44px 조작 영역, 숫자 입력 라벨, 오류 연결, aria-live, 모바일 스크롤·가상 키보드를 지원한다. 확대 이미지와 번호 입력을 함께 확인할 수 있게 한다.
- [ ] `LottoHistoryPanel`에 선택적 `activeTab` / `onTabChange`를 추가해 페이지가 등록 후 탭을 선택하도록 한다. 기존 비제어 사용·화살표/Home/End·선택 해제 동작을 유지한다. React 구성 검토 시 vercel-composition-patterns를 함께 적용한다.
- [ ] 저장 전까지 사진을 보유하며 실패하면 확인 값을 보존한다. 성공/닫기/계정 변경 시 object URL·canvas·bitmap·Worker를 해제한다. 사진, OCR 원문, 번호를 분석 로그에 추가하지 않는다.
- [ ] 출처·등록 시각을 화면과 기존 이미지 내보내기에 표시한다. 구매 시각 또는 추첨 시각으로 잘못 표시하지 않는다.
- [ ] 신규 hook·컴포넌트 테스트와 `LottoPage.history.test.tsx`, `LottoHistoryPanel.test.tsx`를 실행해 전체 PASS를 확인한다.

### Task 5: 리뷰와 수용 검증

**신규:** `frontend/e2e/lotto-ticket-import.spec.ts` (현재 Playwright testDir는 `./e2e`로 확인함)

- [ ] 구현 전에 범위·타입 일관성·판정 공유·저장 완료 정의·기존 호환·사진 비저장을 계획 리뷰한다.
- [ ] 실제 diff를 코드 리뷰해 인증 경계, 취소, 저장 실패, 결과 갱신에 따른 삭제, 중복, ID 생성·구형 데이터 호환성의 유효한 지적을 수정한다.
- [ ] frontend에서 `npm test`, `npm run lint`, `npm run build`를 실행한다. 실제 환경 파일을 읽는 실행 구성이라면 환경 파일을 읽지 않는 검증 구성으로 실행하거나 해당 단계는 사용자 로컬 검증으로 명시한다.
- [ ] 브라우저 320/375/768/1440px·라이트/다크에서 사진 선택·수정·취소·재선택·모델 로드 실패·결과 갱신·저장 실패/재시도·계정 변경·두 탭·삭제/내보내기를 확인한다.
- [ ] frontend에서 `npx playwright test e2e/lotto-ticket-import.spec.ts`를 실행한다. E2E는 OCR 어댑터를 고정 fixture로 바꿔 저장 흐름을 검증하고 실제 OCR 시험을 별도로 진행한다. 모바일 카메라·HEIC 실패 안내는 iOS Safari/Android Chrome 실기로 확인한다.
- [ ] 허가된 테스트 계정·DB에서 저장→새로고침을 확인한다. 네트워크에서 사진은 전송되지 않고 기존 picks JSON만 전송되는지 확인한다. 실제 비밀 설정이 필요한 실행은 사용자가 로컬에서 설정·수행한다.
- [ ] 당첨 알림에 당첨 수·등수·번호가 없고, 전부 미당첨이면 당첨 알림이 나오지 않으며, 기존 당첨이 지워지지 않는지 확인한다.
- [ ] UI 가이드라인을 다시 점검하고 수정 영향을 받는 시험을 재실행한다. 실행 결과·미검증 항목·정확도 측정치를 본 문서에 기록한다.

## 6. 리뷰 중점과 대응 시험

| 실패 조건 | 기대 동작 | 대응 |
| --- | --- | --- |
| 날짜/금액/다른 행을 번호로 잘못 추출 | 확인 전 저장 불가, 불확실하면 수동 수정 | Task 2·4 |
| 화면을 열어둔 상태에서 결과 갱신 | 처리 결과가 달라지면 저장 전 재확인 | Task 2·3·4 |
| PUT 실패 후 재시도/두 번 클릭 | 이중 추가 없이 저장 성공 후에만 완료 | Task 3·4 |
| 사진 인식 중 다른 계정으로 전환 | 사진·인식 결과 폐기, 이전 작업 저장 혼입 방지 | Task 1·3·4 |
| Worker 실패/미지원 사진/메모리 부족 | 수동 입력·재촬영 가능, 기존 내역 보존 | Task 1·2·4·5 |

## 7. 의존성·대상 외·완료 조건

- 순서는 Task 1 실증→Task 2 처리 계약→Task 3 저장→Task 4 UI→Task 5 종합 검증이다. 계획 리뷰는 구현 전에 한다.
- 새 환경변수는 없다. OCR API 키·DB 마이그레이션·Redis 설정·외부 AI 서비스 요금은 필요하지 않다. 라이브러리와 공개 모델의 배포 용량은 증가하므로 초기 페이지에서 지연 로드한다.
- QR만 읽기, 다른 사이트의 조회 URL 요청, 여러 이미지 일괄 처리, 사진 보관, 환급/구매 증명, 클라우드 OCR은 첫 버전 대상이 아니다. 용지 등록은 공식 당첨 확인·환급용 원본을 대체하지 않는다.
- 완료 조건: 확인한 회차·선택 번호만 기존 저장소에 들어가 새로고침 후 유지되고 기존 규칙에 따라 당첨이 남는다. 사진은 전송·영속화되지 않으며 실패·취소·계정 변경이 다른 내역을 훼손하지 않는다. 자동 시험·실기 확인·정확도 목표 증거를 확보한다.
- **계획 작성 당시에는 구현 전이었으며, 현재 구현·검증 결과는 아래 진행 기록을 기준으로 확인한다.**

## 참고 자료

- [Tesseract.js 공식 README](https://github.com/naptha/tesseract.js): 브라우저 OCR과 Worker 실행.
- [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md): 인식 결과·Worker 종료·배포 경로 설정.
- [로컬 배포 설명](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md): core/worker/언어 데이터 제공.

## 계획 셀프 리뷰

- 촬영·선택·수정·저장·기존 당첨 보관·알림 연결을 Task 1~5에서 다뤘다.
- 미확정 결과를 미당첨과 구분했다. 과거 미당첨 제외와 인식 중 결과 갱신에 저장 전 안내·재확인을 포함했다.
- 사진 비저장·구형 JSON 호환·ID 충돌·소유자 경계·이중 저장 시험을 명시했다.
- 인식 정확도를 미리 보장하지 않고 실증을 UI 본구현보다 앞선 채택 기준으로 두었다. 성능 목표 미달을 외부 전송 자동 전환으로 해결하지 않는다.
- 현재 단계는 동일 에이전트의 셀프 리뷰이며 독립 리뷰나 시험 통과를 의미하지 않는다.

## 구현 진행 기록

- 구현 담당: 현재 에이전트. 독립 계획 리뷰를 시도했으나 도구의 agent thread limit으로 실행되지 않아 셀프 리뷰로 대체함. 별도 모델 실행을 주장하지 않음.
- 계획 리뷰 보완: 실제 사진 20장 실증은 허가된 표본이 없어 현재 수행 불가. 기능 구현과 합성 이미지 시험을 진행하되 정확도 목표 달성·출시 검증 완료로 표시하지 않음. 외부 OCR 자동 전환 없음.
- 안전한 실행: Vitest는 envDir:false로 실제 환경 파일 로드를 비활성화. 빌드는 동일 설정의 검증용 구성으로 실행. 비밀 파일·프로세스 환경 값을 조회하지 않음.
- 구현 결정: npm 및 CDN 다운로드가 일반/권한 재시도 모두 ENOTFOUND로 실패. npm 의존을 미완성 lockfile로 남기지 않고 동일 버전의 자체 배포 ESM 엔진을 지연 로드하도록 구성했다. 공개 파일 준비 스크립트를 제공하며 실제 OCR 엔진/모델 파일은 아직 준비되지 않았다. 최초 체크섬은 HTTPS에서 받은 파일로 기록하고 이후 변경을 검출하므로 독립 upstream 체크섬 검증과는 다르다.
- UI 결정: 영역 선택은 드래그 전용 대신 퍼센트 슬라이더로 제공해 터치·키보드 모두 조정 가능하게 한다.


### 구현 결과와 검증 — 2026-10-31

- 추가: 용지 등록 버튼, 촬영/파일 선택, 회전/슬라이더 영역 미리보기, 로컬 OCR 어댑터와 45초 제한·취소·최대 2회 인식, 직접 입력, 회차·줄별 검증/확인, 중복 안내, 과거 결과 미리보기, 확인 후 기존 JSON 저장.
- 저장: 공유 안전 ID 할당, 직렬 저장 revision 완료 대기, operationId 재시도 중복 방지, 계정 전환 시 폐기, 당첨 보관·미당첨 제거·알림 문구 유지. 스키마·Redis·환경변수 변경 없음.
- 계획 조정: 브라우저 배포용 ESM/Worker/core/model 파일을 준비 스크립트에서 제공. 개발 시작 시 다운로드 실패는 안내 후 진행하며 직접 입력을 허용한다. 일반 릴리스 빌드는 준비 실패 시 중단한다. package lock을 허위 생성하거나 외부 CDN 자동 전환을 추가하지 않았다.
- 계획 조정: 파서는 Tesseract가 보존한 텍스트 행 경계와 A~E 표식을 엄격하게 사용한다. 블록 출력은 요청하되 위치 기반 복잡한 영수증 분석은 아직 사용하지 않는다. 모호한 행은 합치거나 추측하지 않고 사용자 수정으로 넘긴다. 실제 표본 기반 인식률 향상은 아래 미검증 항목으로 남는다.
- PASS: 관련 Vitest 15파일 **85개**. 새 파싱·이미지 제한·ID·OCR lifecycle·확인/재시도/결과 갱신·계정 전환 테스트와 기존 6PICK 회귀 테스트 포함.
- PASS: `tsc -b`, `vite build --config vite.validation.config.ts --outDir /private/tmp/pbb-ticket-build-reviewed`. 실제 환경 파일은 읽지 않음. 큰 chunk 경고는 남음.
- PASS: 전체 oxlint exit 0. 기존 ref cleanup 등 경고는 남음. 범위별 git diff --check 및 준비 스크립트 구문 검사 통과.
- 확장 검사: 기본 Vitest 전체 실행 당시 59파일, 239 PASS / 23 FAIL. 실패는 Dieta UI의 document/window 미정의 등 기본 node 환경에서 발생. 별도 `vitest.dieta.config.ts`로 실행한 9파일 41개는 PASS. 기본 전체 명령이 통과했다고 주장하지 않는다.
- 브라우저: CLI Chrome 실행은 권한 재시도 후에도 EPERM/SIGABRT, 로컬 서버 listen도 EPERM. 제공된 Playwright 브라우저 도구에서 실제 빌드 자산을 테스트 라우팅으로 전달해 실행함. 합성 dev 계정/API/OCR 응답을 사용했으며 실제 서버나 DB로 보내지 않음.
- 브라우저 확인: 합성 PNG 선택→실제 canvas 전처리→고정 OCR 응답→1201회/A줄 표시→확인 전 저장 차단→확인 후 저장→mock API 재읽기 유지. 320/375/768/1440px 가로 넘침 없음, 중복 안내 확인. 이 검증은 실제 OCR 정확도 또는 실제 DB 왕복 검증이 아니다.
- 브라우저에서 발견한 동일 sibling key 때문에 등록 창이 중복되는 문제를 실패 테스트로 재현한 뒤 key를 분리해 수정함. 재검증 시 등록 창 1개와 동일 계정 토큰 갱신 중 입력 유지 확인.
- 공유 테스트 기반 보완: Vitest의 envDir:false, 명시적 Testing Library cleanup, Node 26의 native localStorage와 격리된 테스트 Storage. 기존 테스트의 구독/DOM 누수와 테스트 API 초기화 실패를 해결함.
- 코드 리뷰: 독립 에이전트 호출이 thread limit으로 불가해 셀프 리뷰와 실제 브라우저 검사로 대체함. 현재 부모 모델/effort는 노출되지 않아 확인되지 않음.
- 공개 asset 준비: npm registry와 jsDelivr 모두 ENOTFOUND, 권한 재시도도 동일 실패. 실제 엔진·학습 데이터는 아직 다운로드되지 않음. `frontend`에서 `npm run prepare:lotto-ocr` 실행 필요. 신규 core 7의 relaxed-SIMD 변형까지 총 6종의 JS/WASM을 준비하도록 upstream 파일 목록과 로더를 확인해 반영함.
- 미검증/미완료: 실제 OCR 엔진·모델 로딩, 허가된 실제 용지 20장 정확도 목표, iOS/Android 카메라·성능 확인, 실제 DB 저장/새로고침. 사용자 로컬 환경에서 공개 파일 준비와 실서비스 테스트가 필요함. 이 항목이 남아 있어 사진 자동 인식 출시 검증 완료로 표시하지 않는다.
- 최종 UI 재검증: 검토된 빌드에서 앱의 실제 data-theme 방식으로 라이트/다크 각각 320/375/768/1440px 넘침 없음. 입력 대비는 라이트 흰 배경/짙은 글자, 다크 짙은 배경/밝은 글자로 확인. `.dark` 클래스에 의존하던 초기 스타일을 실제 테마 선택자로 수정하고 관련 테스트·타입·빌드를 재실행함.
- 최종 브라우저 저장 검증은 테스트용 API의 JSON PUT/GET 왕복이며 실제 DB 적용을 의미하지 않음. CLI E2E 스펙도 추가했지만 CLI 실행 자체는 Chrome 실행 권한 문제로 통과하지 못했으며, 브라우저 도구의 동등 흐름 검증과 구분함.
