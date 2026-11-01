# Tempori 페이지 보기·제스처 넘김·R2 악보 동기화 구현 계획

> **For agentic workers:** Use `executing-plans` for implementation. One implementation owner; focused independent review when permitted. Follow project AGENTS.md. No automatic commits, deployment, permission changes, or real environment-file access.

**Goal:** PDF와 MusicXML/MXL에서 페이지 단위 악보를 보고, 좌우 스와이프·하단 터치·선택적 카메라 제스처로 넘긴다. 악보 원본은 계정별 Cloudflare R2 저장소에 보관하여 다른 기기에서도 같은 계정으로 로그인하면 열 수 있다.

**Architecture:** 원본 파일 판별/보관, 페이지 렌더러, 페이지 이동 상태, 입력 인식을 분리한다. PDF.js와 OSMD가 동일한 페이지 모델을 제공하고 모든 이동 입력은 하나의 페이지 컨트롤러를 통한다. 기존 한 줄/여러 줄 렌더링·재생·필기 경로는 유지한다. Spring 인증과 DB가 소유권·보관함 메타데이터를 관리하고 비공개 R2가 원본을 저장한다. IndexedDB는 기존 로컬 자료와 계정별 캐시를 담당한다.

**Tech Stack:** 현재 Spring Boot/DB/AWS S3 SDK와 Cloudflare R2, React/TypeScript/Vite/OSMD/IndexedDB + 지연 로드하는 `pdfjs-dist`, `@mediapipe/tasks-vision`. 추가 패키지 버전은 구현 시 현재 프로젝트 빌드/지원 브라우저와 검증해 lockfile에 고정한다. PDF worker와 얼굴 모델/WASM은 버전이 일치하는 자체 호스팅 자산으로 제공한다.

**Spec:** 이 문서에 통합. 사용자의 요청은 좌우 스와이프, 하단 터치, 카메라 제스처, MXL 등 기존 악보 형식의 PDF 같은 페이지 보기다. 2026-11-01 추가 요구: R2 서버 저장 및 다른 기기 로그인 후 악보 열기. 이번 변경은 계획 작성만 하며 구현 완료를 의미하지 않는다.

## 확정 범위와 화면

| 파일 | 보기 선택 | 페이지의 의미 |
| --- | --- | --- |
| PDF | 페이지 보기 | 원본 PDF 페이지 그대로 |
| MXL / MusicXML / XML | 한 줄 / 여러 줄 / 페이지 | OSMD가 생성한 고정 규격 악보 페이지 |

- MXL을 PDF 파일로 변환하거나 기존 원본을 덮어쓰지 않는다. 원본 출판물과 동일한 페이지 나눔은 보장하지 않는다.
- MXL 페이지 규격은 A4 세로, 고정된 논리적 렌더 폭으로 시작한다. 회전/창 크기 변경은 표시 배율만 바꾸고 페이지 번호와 구성을 유지한다. XML의 명시적 줄/페이지 나눔을 존중하되 기존 여러 줄용 강제 마디 수 삽입은 적용하지 않는다.
- 첫 버전은 한 번에 한 페이지. 두 페이지 펼침, PDF 내보내기, OCR/OMR, PDF 마디 자동 추정·박자 기반 자동 넘김은 별도 후속 범위다. 카메라 기능은 이번 계획에 포함하되 기본 OFF인 실험 기능으로 제공한다.
- 페이지 영역은 기존의 작아진 하단 메뉴와 안전 영역을 제외한 공간에 맞춘다. 기본 `페이지 맞춤`, 확대/원위치 기능 제공. 작은 가로 화면에서 글씨가 작을 수 있으므로 확대·이동을 허용한다.
- 하단에는 `이전`, `현재 / 전체 페이지`, `다음`을 표시한다. 좌우 버튼은 하단 넘김 영역을 넓게 분할하고 최소 높이44px를 유지한다. 필기·설정·재생 버튼은 별도 영역이며 터치가 넘김으로 전파되지 않는다. 악보 위에 보이지 않는 터치 영역을 덮지 않는다.
- 기존 보관함 복귀·필기 도구 접기·재생/정지 경로는 유지한다. PDF에는 독립 메트로놈을 제공하고 존재하지 않는 마디 추적/조옮김 UI를 노출하지 않는다.

## 계정별 서버 저장과 기기 간 악보 동기화 (2026-11-01 추가)

### 저장 범위와 사용자 경험

- 로그인 사용자의 신규 PDF/MXL/MusicXML/XML 업로드는 서버 저장을 기본으로 한다. R2에는 업로드한 원본 바이트를 보존하고 변환 SVG/PDF·카메라 영상은 저장하지 않는다. DB에는 소유자, 제목, 작곡가/아티스트, 원본 파일명, 형식, 용량, SHA-256, 객체 키, 상태, 생성 시각, 버전을 저장한다.
- 다른 기기에서 같은 계정으로 로그인하면 서버 보관함을 조회하고 동일 원본을 열 수 있다. 보관함 진입/포커스 복귀/수동 새로고침에서 다시 조회한다. 실시간 공동 편집은 범위 밖이다.
- UI 상태는 `서버에 저장 중 / 서버에 저장됨 / 저장 실패·재시도 / 이 기기에만 있음`으로 구분한다. 로컬 저장만 성공한 파일을 동기화 완료로 표시하지 않는다. 비로그인 사용자의 기존 로컬 이용은 유지하며 서버 저장은 로그인 후 제공한다.
- 이번 서버 동기화 범위는 **악보 원본과 보관함 메타데이터**다. 필기·연습 위치·템포·보기 설정은 기존처럼 기기별이며 UI에도 안내한다. 이 데이터의 다중 기기 병합은 별도 후속 범위로 둔다. 기존 필기를 삭제하거나 서버에 보관됐다고 표시하지 않는다.

### 현재 구조와 변경 경계

- 현재 `frontend/src/features/tempori/services/temporiRepository.ts`는 IndexedDB 로컬 함수만 호출한다. 기존 함수 인터페이스를 유지하면서 로컬 ID/서버 ID에 따라 저장소를 분기하고 `loadScoreSource`에는 동일한 Blob을 공급한다.
- 기존 `spring_backend/.../global/r2/R2StorageService.java`는 공개 이미지 URL 반환과 실패를 삼키는 삭제 경로가 있다. 이 경로를 악보에 그대로 사용하지 않는다. S3 클라이언트 구성 방식은 재사용하되 악보 전용 private storage 서비스와 실패가 전파되는 삭제 API를 분리한다. 기존 이미지 기능의 버킷/공개 URL 설정은 변경하지 않는다.
- 악보 전용 비공개 버킷을 사용한다. 공개 도메인/r2.dev 접근을 켜지 않으며 객체 키 접두어만으로 공개 버킷 안의 비밀성을 확보했다고 간주하지 않는다. 객체 키는 서버 생성 UUID를 포함하고 사용자 파일명/이메일은 넣지 않는다.

### API와 데이터 일관성

- `POST /api/v1/tempori`: 인증된 multipart 업로드(file, title, artist), `Idempotency-Key` 필수. 서버 인증 principal로 소유자를 결정한다. 클라이언트 userId는 권한 근거로 받지 않는다. 첫 버전은 서버 경유 업로드로 크기·형식 검증과 공개 전 완료 상태를 통제한다.
- 초기 제한은 파일당25MiB, 계정당 총500MiB·200개. 파일 크기를 스트림에서 제한하고 동시 업로드도 DB 예약 용량에 포함한다. 확장자/MIME만 믿지 않고 파일 시그니처와 내부 구조를 검사한다. MXL은 압축 해제 합계100MiB·항목1000개 제한, 경로 순회 차단, XML 외부 엔티티/DTD 비활성화. PDF는 암호화/손상 파일을 기존 페이지 뷰어 정책과 맞춰 거절한다. 클라이언트 사전 검증과 서버 검증을 구분한다.
- DB 상태 `UPLOADING → READY`, 실패 시 `FAILED`, 삭제 시 `DELETING → DELETED`. 업로드 전 소유자별 멱등 키와 용량 예약을 트랜잭션으로 기록하고, R2 저장 확인 후 READY를 커밋한다. READY 전에는 다른 기기 목록/다운로드에 노출하지 않는다. 같은 키의 다른 파일/메타데이터 요청은409, 같은 요청 재시도는 동일 악보 ID를 반환한다.
- R2와 DB는 단일 트랜잭션이 아니므로 DB에 지속 작업/재시도 상태를 남긴다. R2 성공 후 DB 실패·서버 종료는 재조정 작업이 복구하거나 orphan 객체를 정리한다. 진행 중 업로드를 정리하지 않도록 lease/상태를 확인하며 오래된 실패 건(24시간 이상)을 대상으로 한다. 원본 파일 교체는 첫 버전에서 제공하지 않는다.
- `GET /api/v1/tempori?cursor=...`는 본인 READY 목록, `GET /api/v1/tempori/{id}`는 본인 상세, `POST /api/v1/tempori/{id}/download-url`은 소유권 재검증 후 유효기간5분의 GET 서명 URL과 만료 시각을 반환한다. URL은 DB에 저장하거나 로그에 남기지 않는다. URL 보유자는 만료 전 접근 가능하므로 이를 즉시 철회 가능한 세션 URL로 설명하지 않는다.
- 클라이언트는 서명 URL로 원본 Blob을 받아 기존 로더로 전달한다. 만료 실패 시 인증 API를 통해1회 재발급하며 무한 재시도하지 않는다. R2 S3 API 도메인을 사용하고 CORS에는 실제 앱 origin과 필요한 GET/HEAD만 허용한다. 프런트엔드에 R2 비밀키를 전달하지 않는다.
- `DELETE /api/v1/tempori/{id}`는 소유권 확인 후 DELETING과 영속 삭제 작업을 함께 기록해 목록/신규 URL 발급에서 즉시 제외한다. R2 삭제는 재시도하고 성공 시 DELETED, 이미 삭제된 요청은 멱등 처리한다. 삭제 오류를 성공으로 삼키지 않는다. 계정 탈퇴도 동일한 정리 작업을 예약한다. 이미 발급된 URL은 객체 삭제 전까지 최대 남은5분 유효할 수 있다.
- 타인 ID의 조회·다운로드·삭제는404, 비로그인 요청은401로 통일하고 목록에 타인의 존재/메타데이터가 드러나지 않게 한다. 기존 인증/CSRF 정책을 유지한다. 메타데이터 응답과 서명 URL 발급은 private/no-store로 처리한다.

### 기존 로컬 자료 이전과 계정 전환

- `이 기기의 악보를 계정에 저장`에서 목록·개수·총용량과 대상 계정을 보여주고 선택한 파일만 이전한다. 기존 로컬 userId 문자열이나 guest 자료를 로그인 계정에 자동 귀속시키지 않는다.
- 로컬 ID→서버 ID 매핑과 계정별 migration job/멱등 키를 저장한다. 업로드 중단/새로고침 후에도 재시도하며 READY와 원본 hash/크기 확인 전 로컬 원본을 삭제하지 않는다. 완료 후에도 로컬 사본 삭제는 별도 명시적 동작이다.
- 동일 계정 내 hash로 중복 후보를 보여주되 제목이 같은 파일을 자동 합치거나 서로 다른 계정의 파일 존재를 노출하지 않는다. 매핑을 통해 보관함 중복 표시를 피하고 기존 로컬 URL과 필기 키를 계속 해석한다. 필기는 업로드되지 않으며 해당 기기의 기존 ID 연결을 보존한다.
- 캐시/업로드 작업 키는 서버 principal ID와 악보 ID로 구분한다. 로그아웃/계정 변경 시 진행 요청 취소, session revision 변경, Blob URL/화면 상태 정리 후 이전 계정의 늦은 응답을 폐기한다. 로컬 미저장 초안은 소유 계정에 남기고 다른 계정 화면에는 노출하지 않는다.
- 오프라인에서는 이미 기기에 있는 자료만 열 수 있음을 표시한다. 실패한 서버 목록 조회를 빈 보관함으로 덮어쓰지 않는다. 재연결 시 소유권/삭제 상태를 확인하고 서버 삭제가 확인된 캐시는 제거한다. 서버 조회 없이 다른 기기의 최신 삭제 상태를 보장한다고 표시하지 않는다.

### 설정·배포와 검증

- 계획 단계에서는 실제 R2 자원 생성이나 환경 파일 변경을 하지 않는다. 구현 시 코드와 안전한 템플릿만 근거로 기존 R2 연결 설정을 재사용하고, 별도 버킷용 `TEMPORI_R2_BUCKET` 및 서버 제한값 `TEMPORI_MAX_FILE_BYTES`, `TEMPORI_MAX_USER_BYTES`, `TEMPORI_MAX_USER_FILES`를 승인된 `.env.example`에 문서화한다. 실제 `.env`와 R2 자격증명은 읽거나 자동 수정하지 않으며 사용자가 직접 설정한다.
- 운영 전 비공개 버킷·최소 범위 토큰·CORS·서버 multipart 및 reverse proxy 크기 제한을 맞춘다. 인증과 실제 R2가 필요한 검증은 사용자 구성 후 수행하며 mock 성공을 실환경 검증으로 보고하지 않는다.
- 두 독립 브라우저에서 계정A 업로드→B기기 같은 계정 목록/원본 hash 일치/열기, 다른 계정 접근 차단, 계정 전환 중 늦은 응답, 업로드/DB 장애 및 중복 재시도, 제한 초과·압축 폭탄, R2 삭제 실패 복구·탈퇴 정리, 로컬 이전 중단/필기 보존을 인수 조건으로 둔다.

## 공통 상태와 인터페이스

새 경로는 `frontend/src/features/tempori/pages/` 아래에 둔다.

```ts
type ScoreSource =
  | { kind: 'pdf'; id: string; blob: Blob }
  | { kind: 'musicxml'; id: string; xml: string };
type ScoreViewMode = 'wrapped' | 'horizontal' | 'pages';
type PageTurnOrigin = 'swipe' | 'bottom' | 'keyboard' | 'camera' | 'playback';
type ScorePage = {
  index: number; width: number; height: number;
  firstMeasureIndex?: number; lastMeasureIndex?: number;
};
type PageTurnRequest = { delta: -1 | 1; origin: PageTurnOrigin; timestamp: number };
```

- `loadScoreSource(id): Promise<ScoreSource>`은 파일 종류를 판별한다. 기존 `fetchTemporiMusicXml`의 호출 호환성은 유지한다.
- `useScorePages`가 페이지 목록/현재 인덱스/확대 상태/준비 상태/전환 상태/재시도/`requestTurn(request)`를 소유한다. PDF와 XML 렌더러는 페이지 생성/폐기와 크기·마디 매핑만 담당한다.
- 이동 순서: 입력 유효성 확인 → 현재 필기 flush 성공 확인 → 목적 페이지 렌더 완료 확인 → 180ms 전환 → 인덱스 확정. 실패하면 원래 페이지/필기를 유지하고 재시도 표시.
- 0부터 시작하는 내부 인덱스와 1부터 시작하는 표시 번호를 분리한다. 첫/마지막 페이지는 clamp하고 버튼을 비활성화하며 카메라 인식으로 순환하지 않는다.
- 전환 중 추가 입력은 쌓지 않는다. touch/pointer 종료 후 발생하는 합성 click과 카메라·터치 동시 입력도 한 전환만 허용한다. 최신 문서 ID와 render revision이 다른 비동기 결과는 폐기한다.
- 이동 완료 후 확대 배율/이동 오프셋을 페이지 맞춤으로 초기화한다. 회전은 현재 페이지와 필기 위치를 유지한다. `prefers-reduced-motion`에서는 전환 애니메이션을 생략한다.

## 입력 규칙

### 좌우 스와이프

- 왼쪽으로 밀면 다음 페이지, 오른쪽으로 밀면 이전 페이지.
- 기본 인식값: 수평 이동 `max(48px, viewportWidth × 0.08)` 이상, 수평 이동이 수직의1.5배 이상, 800ms 이내. 값은 실제 기기 사용성 검증으로 조정하되 테스트와 함께 변경한다.
- 페이지 맞춤 상태의 한 손가락 입력만 넘김 대상이다. 확대 중에는 드래그로 악보를 이동하며, 두 손가락/핀치·pointercancel·펜/형광펜/지우개·열린 설정·버튼/슬라이더에서 시작한 입력은 제외한다.
- 수직 스크롤/브라우저 확대를 전역에서 막지 않는다. 터치 시작 때 무조건 preventDefault하지 않고, 네이티브 스크롤 경합과 pointercancel을 브라우저에서 검증한다.

### 하단 터치와 접근성

- 하단의 명시적인 이전/다음 버튼 탭으로 한 페이지씩 이동한다. 드래그·길게 누름에는 반복 이동하지 않는다.
- 필기 도구가 활성화되어도 하단 버튼으로 넘길 수 있으며 진행 중 스트로크는 저장 후 이동한다. 악보 위 스와이프와 카메라는 필기 중 일시 중지한다.
- 방향키/PageUp/PageDown도 같은 컨트롤러에 연결한다. 입력창/슬라이더/설정 창 포커스에서는 가로채지 않는다. 버튼의 접근 가능한 이름, 페이지 변경 상태 안내, 가시적 키보드 포커스를 제공한다.

### 카메라 제스처

- 기본안은 **고개를 오른쪽으로 돌려 유지 → 다음 / 왼쪽 → 이전**이다. 자연스러운 눈 깜박임은 사용하지 않는다. 좌우 동작은 설정에서 반전할 수 있다.
- 사용자가 `카메라로 넘기기 켜기`를 눌렀을 때만 전면 카메라 권한을 요청한다. 마이크는 요청하지 않는다. 작은 미리보기·카메라 사용 중 표시·즉시 끄기를 제공한다.
- 정면2초 보정 후 연습 화면에서 양쪽 동작을 확인한다. 회전/방향 반전 후에는 다시 보정한다. 미러링된 미리보기와 실제 명령 방향을 별도로 처리해 혼동을 방지한다.
- 인식 속도 설정: **빠르게300ms / 기본450ms / 신중하게700ms** 중 선택하며 최초 기본값은450ms다. 정면 대비 yaw25도 이상을 선택한 시간 동안 연속 유지해야 발동한다. 저장된 설정이 없거나 유효하지 않으면 기본값을 사용한다. 설정 변경 시 진행 중 holding을 폐기하고 정면 확인 후 다시 인식한다.
- 연속 넘김 방지: 세 속도 모두 발동 후 최소1.5초 대기와 정면±8도 범위300ms 복귀 조건을 충족해야 다시 인식한다. 방향을 계속 유지해도 한 번만 넘긴다.
- 기본 속도의 예상 반응 시간은 고개가25도 기준을 넘은 시점부터 페이지 전환 시작까지 약0.5~0.7초를 목표로 한다. 고개를 돌리는 데 걸리는 시간과 페이지 전환 애니메이션 완료 시간은 별도다. 이는 실기기 측정값이나 성능 보장이 아니며 추론 지연·프레임 간격·페이지 준비 상태에 따라 달라진다. 실제 연주 중 반응 속도와 오작동을 측정해 초기값을 조정하고 관련 테스트도 함께 갱신한다.
- 상태 머신: `off → requesting → calibrating → armed → holding → cooldown → neutral → armed`, 별도로 `suspended/error`. 프레임마다 명령을 발생시키지 않는다.
- 얼굴이 없거나 여러 얼굴·낮은 신뢰도(초기0.8 미만)·500ms 이상 결과 공백이면 holding을 폐기한다. 복귀 후 정면 확인을 다시 거친다. 어두운 환경/기기 흔들림/긴 머리·안경 등은 실제 기기로 확인한다.
- 설정/필기/핀치 확대/페이지 렌더 실패/전환 중에는 자동 넘김을 일시 중지한다. 사용자가 수동으로 페이지를 넘겨도 카메라는 neutral 재확인 전까지 재발동하지 않는다.
- 권한 거절, 모델 다운로드 실패, 미지원 환경에서는 수동 넘김을 유지한다. 권한을 반복 요청하지 않고 사용자가 재시도할 수 있게 한다.
- 영상은 기기 내 추론만 수행하고 저장·업로드·분석 로그에 포함하지 않는다. 얼굴 좌표/프레임도 영구 저장하지 않는다. 저장 대상은 인식 속도·방향 등의 설정뿐이며 카메라 ON 상태는 저장하지 않는다.
- 기본 처리640×480, 최대10fps, 한 번에 하나의 추론. Worker에 최신 프레임만 전달하고 밀린 프레임은 폐기한다. Worker 경로가 검증되지 않은 브라우저에 메인 스레드 추론을 조용히 대체하지 않는다.
- OFF/다른 악보/페이지 모드 종료/탭 숨김/unmount에서 media tracks·worker·프레임 자원을 종료한다. 늦게 완료된 권한 요청도 세션 토큰을 검사해 즉시 tracks를 정리한다. 돌아오면 명시적으로 다시 켠다.

## PDF·MusicXML 렌더링과 기존 재생

- PDF.js worker로 실제 PDF를 해석하고 원본 페이지 회전값을 반영한다. 비밀번호 PDF는 초기 버전에서 명확히 지원 불가로 안내하며 암호를 저장하지 않는다. 손상/빈/지원하지 않는 문서에서 빈 화면 대신 오류·보관함 복귀 제공.
- PDF canvas는 현재·직전·다음 페이지만 유지한다. 각 backing canvas는4MP/긴 변4096px/DPR2 이하, 주석 포함 총16MP 이하로 제한한다. 축소 후 확대 품질은 필요한 페이지를 다시 렌더링한다. renderer 취소, worker 종료, object URL 해제 포함.
- XML 페이지 렌더러는 OSMD `pageFormat: 'A4 P'`를 load 전에 적용하고 SVG 페이지를 유지한다. 전체 DOM/메모리 비용을 300마디 prototype에서 측정한 뒤 렌더러 연결을 확정한다. 실제 페이지·마디 매핑을 검증하며 누락 마디를 추정 좌표로 감추지 않는다.
- MXL의 재생·반복·템포·조옮김 데이터는 기존 경로를 공유한다. 페이지 보기에서도 재생 마디→페이지 매핑으로 자동 따라가기를 제공하되, 수동/카메라 넘김은 **따라가기만 중지**하고 연주 위치는 바꾸지 않는다. `현재 마디로`가 복귀 동작이다.
- PDF 페이지 이동은 메트로놈 시간을 리셋하지 않는다. PDF에 마디 기반 자동 따라가기가 있는 것처럼 표시하지 않는다.
- 보기 전환은 재생/예비박을 멈추고 현재 물리 마디·연습 범위를 보존한다. XML에서 페이지 보기로 들어오면 해당 마디의 페이지를 연다. 복귀도 같은 마디를 기준으로 한다.
- 기존 `tempori:view-mode` 값 wrapped/horizontal을 보존하고 pages를 추가한다. PDF는 항상 pages를 사용하며 XML의 저장 선호를 덮어쓰지 않는다. 저장 불가 시 세션 내 선택은 유지한다.

## 필기와 데이터 보존

- 기존 wrapped v1/horizontal v2 필기는 변경하거나 페이지 필기로 자동 이전하지 않는다.
- 새 페이지 필기는 `tempori:annotations:pages:<id>:<layoutKey>` 별도 문서로 저장한다. v1 page 문서 `{version:1, pages:[{pageIndex, strokes:[{id,tool,color,widthPageRatio,points:[{x,y}]}]}]}`; 좌표는 회전 전 페이지의 정규화 좌표다.
- PDF layoutKey는 원본 파일 식별자와 원본 페이지 회전 기준이다. XML은 원본·A4 규격·OSMD 버전·조옮김을 반영한 결정적 fingerprint를 사용한다. 화면 크기/배율은 키에 포함하지 않는다.
- XML 조옮김처럼 실제 조판이 바뀌면 별도의 필기를 사용한다. 기존 필기는 보존하고 같은 조판으로 복귀하면 다시 보인다. UI에 `페이지 필기는 조옮김 설정별로 따로 저장됩니다`를 명시한다. 마디에 붙는 필기 이식은 이 범위에서 추가하지 않는다.
- 페이지/보기/문서 변경 전에 유효한 진행 중 스트로크를 확정하고 flush한다. 실패하면 현재 페이지를 유지한다. SPA 강제 전환의 미저장 데이터는 기존 방식처럼 문서/레이아웃별 세션 메모리에 보존한다. 손상된 저장 문서는 덮어쓰지 않고 읽기 오류를 안내한다.
- `전체 지우기`는 현재 페이지에만 적용하며 버튼 문구도 `이 페이지 필기 지우기`로 명확히 한다. 악보 삭제는 DB commit 뒤 기존 두 보기 + 모든 pages layoutKey/세션 draft를 정리한다. 정리 실패는 이미 삭제한 악보를 다시 삭제하지 않고 정리만 재시도한다.

## 구현 작업과 파일

각 작업은 실패 테스트 작성/실패 확인 → 구현 → 해당 테스트/타입 검사 → diff 검토 순서로 진행한다. 한 구현자가 순서대로 작업하며 임의 커밋/배포는 하지 않는다.

### 0. 인증된 R2 보관함과 로컬 이전

- 추가: `spring_backend/src/main/java/com/studiobs/spring_backend/domain/tempori/` 아래 controller/service/entity/repository/dto와 private R2 storage adapter·재조정 작업; 대응 `src/test/java/.../domain/tempori/` 테스트. DB migration은 `infra/mysql/migrations/20261101_tempori_cloud_library.sql`에 악보/용량 예약·멱등/영속 작업 테이블을 추가한다.
- 수정: 기존 인증 정책과 계정 삭제 서비스의 Tempori 연동 지점, 악보 전용 R2 설정 클래스/승인된 환경 템플릿. 기존 이미지 저장 API는 보존한다.
- 수정: `frontend/src/features/tempori/services/temporiRepository.ts`, `utils/temporiLoader.ts`, `utils/localTempori.ts`, `types/library.ts`, `frontend/src/pages/TemporiLibraryPage.tsx`. 추가: `services/temporiCloudApi.ts`, `services/temporiMigration.ts`와 테스트. 공통 API/auth 클라이언트 관례를 구현 전에 확인한다.
- [ ] 먼저 소유권/용량 예약/멱등 업로드/DB-R2 부분 실패/삭제 재시도 테스트를 작성하고 실패를 확인한다.
- [ ] 위 API 계약과 DB 상태 전이를 구현하고 mock S3와 DB 통합 테스트로 권한 격리·재시도·최종 상태를 검증한다.
- [ ] 프런트엔드 저장소 분기·서버 저장 상태·계정 전환 취소와 명시적 로컬 이전을 구현한다. 기존 로컬 URL/필기 보존과 두 세션 보관함 테스트를 통과시킨다.
- [ ] 인증·데이터 보존 부분은 독립 검토가 허용되면 집중 리뷰하고 수정 후 재검증한다. 실환경 구성 전에는 실제 R2/두 기기 동기화가 미검증임을 기록한다.

### 1. 파일 판별과 PDF 저장/열기
- 수정: `utils/temporiLoader.ts`, `utils/musicXmlMetadata.ts`, `pages/TemporiLibraryPage.tsx`, `pages/TemporiPage.tsx`, `types/library.ts`, `types/index.ts`, `services/temporiRepository.ts`, `utils/localTempori.ts` (첫 두 pages 경로는 `frontend/src/pages/`; 나머지는 `frontend/src/features/tempori/` 기준).
- 추가: `pages/scoreSource.ts`, `pages/scoreSource.test.ts`.
- [ ] PDF/MXL/XML 판별은 확장자·MIME만 믿지 않고 `%PDF-`/ZIP 내용/XML root로 검증. iPhone의 빈 MIME·대문자 확장자·기존 파일 선택 허용 동작 테스트.
- [ ] `loadScoreSource` 구현. 기존 레코드에 필수 새 필드를 강제하지 않고 파일 bytes로 읽기 호환 유지. PDF 제목 초기값은 파일명, PDF를 XML 메타데이터 parser로 보내지 않는다.
- [ ] 원본 바이트 보존, DB 저장 실패/재시도, 구형 MXL 보관함 재열기 테스트.

### 2. 공통 페이지 상태와 두 렌더러
- 추가: `pages/types.ts`, `pages/useScorePages.ts`, `pages/ScorePageViewer.tsx`, `pages/PdfPageRenderer.tsx`, `pages/MusicXmlPageRenderer.tsx` 및 각각의 `.test.ts(x)`.
- 수정: `Tempori.tsx`, `utils/viewMode.ts`, `components/OsmdViewer.tsx` (공유할 최소 렌더 계약만 추출), `frontend/package.json`, lockfile.
- [ ] 먼저 PDF1/20/100페이지와 XML8/100/300마디 prototype으로 page bounds·완전성·메모리를 측정. 설치된 OSMD API와 PDF worker Vite 번들 호환성을 확인.
- [ ] 고정 A4 조판과 배율 조정 분리, XML 물리 마디→페이지 매핑, PDF 현재/인접 페이지 렌더 취소/재시도 구현.
- [ ] 원본별 보기 선택, 시작/마지막 경계, 회전 후 페이지 유지, 빠른 모드 전환/이전 비동기 결과 폐기, 재생 중 수동 이동과 복귀 테스트.

### 3. 스와이프·하단 터치·키보드
- 추가: `pages/pageTurnController.ts`, `pages/usePageTurnInput.ts`, `pages/PageTurnBar.tsx` 및 테스트.
- 수정: `components/TemporiViewerDock.tsx`, `frontend/src/index.css`, i18n messages.
- [ ] 공통 requestTurn guard와 전환 잠금 먼저 테스트: 중복 입력1회 처리, 끝 페이지에서 유지, 미준비/저장 실패 시 유지.
- [ ] 스와이프 각도/거리/시간 경계와 핀치·필기·버튼 제외 구현. native pointercancel, 방향키 포커스 예외 테스트.
- [ ] 390×844,844×390,568×320,1024×768,1440×900에서 페이지/하단 터치 영역/필기 도구가 겹치지 않는지 브라우저 확인.

### 4. 페이지 필기와 저장 수명주기
- 추가: `pages/PageAnnotationLayer.tsx`, `pages/pageAnnotations.ts` 및 테스트.
- 수정: `utils/temporiAnnotations.ts`, 삭제 정리 경로, 필요한 페이지 저장 상태 UI.
- [ ] 저장 schema/layoutKey, 확대·회전의 좌표 왕복, 조옮김 후 기존 필기 보존 테스트.
- [ ] 전환 전 flush·실패 재시도·pointercancel·현재 페이지 지우기·unmount draft·빠른 문서 변경을 구현/검증.
- [ ] 단건/일괄 삭제 성공/실패/정리만 재시도에서 모든 page 레이아웃과 기존 주석이 올바르게 유지/삭제되는지 검증.

### 5. 카메라 제스처
- 추가: `pages/camera/gestureState.ts`, `pages/camera/useCameraPageTurn.ts`, `pages/camera/faceLandmarker.worker.ts`, `pages/camera/CameraTurnSettings.tsx`, 상태/훅/UI 테스트와 모델 자산 manifest.
- [ ] 실제 카메라 없이 timestamp·yaw·confidence sequence로 정면/유지/대기/복귀/얼굴 유실/중복 명령 상태 테스트를 먼저 작성. 세 유지 시간300/450/700ms의 직전에는 미발동, 도달한 첫 유효 결과에서1회 발동, 모든 속도에서1.5초 대기와 정면300ms 복귀를 모두 요구함을 검증한다.
- [ ] `CameraTurnSettings`에 빠르게/기본/신중하게 선택과 유지 시간 설명을 제공하고 설정 저장·복원을 구현. 최초/유효하지 않은 값은450ms, 변경 시 holding 폐기와 정면 재확인을 테스트한다.
- [ ] 권한은 버튼에서만 요청; 모델/worker 지연 로드, 보정·방향 반전·미리보기·중지·실패 복구 구현.
- [ ] getUserMedia 지연 완료 후 화면 이탈, worker 오류, 숨겨진 탭, 빠른 ON/OFF에서 track/프레임 누수 없는지 테스트.
- [ ] 지원 대상 실제 iPhone/iPad Safari·Android Chrome·데스크톱 카메라에서 양쪽 방향을 검증. 안정적 Worker/카메라 경로가 불가능한 환경은 명확한 미지원 상태와 수동 입력을 제공.

### 6. 통합 검증과 자체/독립 검토
- [ ] `node node_modules/vitest/vitest.mjs run src/features/tempori src/components/TemporiViewerDock.test.tsx src/pages/TemporiPage.test.tsx` 및 신규 library 테스트를 frontend에서 실행. Vitest envDir:false 유지.
- [ ] `node --import ./tests/registerTypeScript.mjs --test tests/*.node-test.mjs`, `node node_modules/typescript/bin/tsc -b`, 변경 파일 lint, `git diff --check`.
- [ ] Vite API `build({envDir:false,...})`로 production build. 기본 명령의 실제 .env 자동 로딩 및 관련 없는 OCR prebuild를 실행하지 않는다.
- [ ] Chromium/WebKit 자동 검증과 네이티브 기기 검증을 구분해 기록. 카메라 테스트는 명시적 사용자/테스터 활성화로만 수행하고 얼굴 영상은 테스트 산출물에 저장하지 않는다.

## 완료 기준과 검토 초점

1. 세 입력이 같은 페이지 상태를 사용하고, 1번 동작으로1페이지만 이동한다. 스와이프와 합성 click/카메라 동시 발동 테스트 포함.
2. 필기·확대·회전과 넘김이 충돌하지 않는다. 미저장/손상 문서·삭제 실패로 데이터가 사라지지 않는다.
3. MXL 페이지 보기는 원본 손실 없이 기존 보기로 왕복하며 마디/연습 구간을 보존한다. 페이지 번호는 화면 크기 변화로 바뀌지 않는다.
4. 준비된 페이지의 전환 시작은 입력 후100ms 이내, 애니메이션180ms, 렌더 대기 중에는 기존 페이지를 유지한다. 대표 문서 첫 페이지는 측정 기기별5회 모두5초 이내를 목표로 측정하며 초과 시 출시 전 렌더 전략을 재검토한다.
5. 카메라는 각 지원 테스트 기기에서 의도적인 동작20회 중19회 이상 한 번씩 인식, 정면으로 악보 읽기10분 동안 오넘김0회를 초기 출시 기준으로 측정한다. 세 속도별 인식률·오넘김과 기준 각도 도달→전환 시작 지연을 측정하고, 기본 속도0.5~0.7초 목표 및 애니메이션 완료 시간을 구분해 기록한다. 안경/조명/회전별 결과를 기록하고 미달 환경은 실험 기능의 지원 범위를 축소한다. 수치는 검증 목표이며 현재 통과한 결과가 아니다.
6. 페이지 넘김/카메라 동작 중 메트로놈과 기존 재생 타이밍에 장시간 메인 스레드 추론 정지가 없다. Worker 지원·발열·메모리·권한 거절은 실제 환경에서 확인해야 한다.

계획 자체 검토 완료: 파일별 보기, 세 입력, 보정/오작동 방지, 기존 선호·필기·삭제 호환성, 재생과 수동 탐색의 관계, 비동기 취소, 검증 범위를 점검했다. 구현과 실기기 검증은 아직 수행하지 않았다.

## 기술 근거

- PDF.js 공식 [examples](https://mozilla.github.io/pdf.js/examples/): 문서/페이지 로딩, 페이지 viewport와 캔버스 렌더링.
- OSMD [IOSMDOptions](https://opensheetmusicdisplay.github.io/classdoc/interfaces/IOSMDOptions.html) 및 설치된 `OSMDOptions.d.ts`: pageFormat/newPageFromXML/newSystemFromXML 옵션. 실제 설치 버전을 기준으로 prototype 검증한다.
- MediaPipe 공식 [Face Landmarker Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js): 얼굴 landmark/변환 행렬, 동기 추론 호출과 Worker 권장. 고개 제스처 상태 머신/임계값은 앱에서 별도 구현한다.
- [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia): 보안 컨텍스트 및 권한 요구. HTTPS 지원 배포에서 카메라 동작을 검증한다.

## R2 근거 자료

- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/): 단일 객체 작업의 만료 URL과 S3 API 도메인 사용.
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/): 브라우저가 R2에서 파일을 읽을 수 있도록 origin/메서드 정책 구성.

계획 자체 검토: 서버 저장을 페이지 렌더러에 결합하지 않고 Task 0 저장소 계약으로 분리했다. 기존 제스처 속도와 페이지 기능 범위를 유지하며 권한·부분 실패·기존 자료 보존·다른 기기 열기에 구현 및 검증 단계를 연결했다. 구현 순서는 Task 0 → 파일 판별/페이지 렌더러 → 넘김/필기 → 카메라 → 통합 검증이다.
