# PBB — Play beom's BAG

취미 앱을 모아 둔 **PBB** 플랫폼입니다.  
메인 브랜드는 **PBB (Play beom's BAG)** 이며, 홈에서 카테고리별 취미 앱으로 진입합니다.

## 현재 앱

| 앱 | 경로 | 설명 |
|----|------|------|
| iPBT | `/hobbies/ipbt` | 날씨를 보고 야구가 가능한지 보는 앱 (스캐폴드) |
| Veveno | `/hobbies/veveno` | 가게 노트. 랜딩 공개 · 허브 `/hub` · 가게 `/stores/:id` (로그인 필수) |
| 6PICK | `/hobbies/lotto` | 로또 번호 생성·세금 계산·회차 관리 (당첨번호 자동 동기화) |
| Score Viewer | `/hobbies/score-viewer` | MusicXML/MXL 악보 보관함·연습 뷰어 (OSMD) |

하위 호환 리다이렉트: `/hobbies/analyze-baseball` → iPBT, `/hobbies/brew-note` → Veveno

공통 기능: 회원가입(약관 동의) · 로그인 · JWT · 프로필 · 회원 등급(FREE/DEV) · 회원 탈퇴 · 점검/오류/404 화면

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Vite, React, TypeScript, Zustand, Axios, React Router, OpenSheetMusicDisplay, JSZip |
| Main Backend | Java 25, Spring Boot, Spring Security, JPA, Redis, Mail, Scheduling, R2(S3 API) |
| Analytics Backend | Python, FastAPI (스캐폴드) |
| Infra | MySQL 8, Redis 7, Docker Compose |

## 구조

```text
PBB/
├── frontend/                 # Vite + React
├── spring_backend/           # Spring Boot API
├── fastAPI_backend/          # FastAPI (스캐폴드)
├── infra/mysql/init.sql      # 현재 최종 스키마 (신규 DB 단일 출처)
├── docker-compose.yml        # 로컬 MySQL + Redis
├── docker-compose.prod.yml   # 운영 backend + MySQL + Redis + Tunnel
└── docs/                     # 유저 흐름도 등
```

```text
com.studiobs.spring_backend
├── global/     # config, security, exception, scheduling, R2
└── domain/
    ├── auth/     # 회원가입·로그인·JWT·탈퇴·rate limit
    ├── user/     # User, UserConsent
    ├── config/   # app_config (추천 앱)
    ├── brew/     # Veveno (API 접두사 /api/v1/brew)
    ├── lotto/    # 6PICK + 동행복권 동기화 스케줄러
    ├── dev/      # DEV 관리 (회원 등급·추천 앱·R2)
    └── mail/
```

## 인증

- **Access Token** (30분): JSON Body → 프론트 Zustand **메모리**만 보관
- **Refresh Token** (7일): Redis `RT:{email}` + HttpOnly 쿠키
- 비밀번호: BCrypt · 회원 ID: UUID (`CHAR(36)`)
- 회원가입 동의: `user_consents` (필수: 이용약관 / 개인정보 / 만 14세 · 선택: 마케팅)
- Rate limit (IP·이메일 각각): 메일 발송·검증·로그인 — 초과 시 HTTP 429

## 주요 API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/auth/email/request` | 회원가입 이메일 코드 발송 |
| POST | `/api/v1/auth/email/verify` | 코드 검증 |
| POST | `/api/v1/auth/signup` | 회원가입 (+ 동의 목록) |
| POST | `/api/v1/auth/login` | 로그인 |
| POST | `/api/v1/auth/refresh` | Access Token 재발급 |
| POST | `/api/v1/auth/logout` | 로그아웃 |
| DELETE | `/api/v1/auth/account` | 회원 탈퇴 |
| GET | `/api/v1/config/featured-app` | 홈 추천 앱 목록 (공개) |
| PUT | `/api/v1/dev/featured-app` | 추천 앱 설정 (DEV) |
| — | `/api/v1/brew/**` | Veveno 가게·메뉴·재고·근무·공지 등 |
| — | `/api/v1/lotto/**` | 6PICK 회차·picks (DEV 회차 관리 포함) |

## 로컬 실행

### 1. 인프라

```bash
docker compose up -d
```

| 서비스 | 포트 | 참고 |
|--------|------|------|
| MySQL | 3306 | DB `baseball_db` / user `baseball_user` / pw `baseball_password` |
| Redis | 6379 | 비밀번호 없음 |

신규 컨테이너는 `infra/mysql/init.sql`로 전체 스키마가 생성됩니다.

### 2. Spring Backend

```bash
cd spring_backend
cp .env.example .env
./gradlew bootRun
```

- 기본 프로필: `dev` (인증 코드는 콘솔 mock 메일)
- API: `http://localhost:8080`

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:8080
npm install
npm run dev
```

- 앱: `http://localhost:5173`

### 4. FastAPI (스캐폴드)

```bash
cd fastAPI_backend
uvicorn main:app --reload
```

## 배포 (Production)

프론트는 **Cloudflare Pages**, 백엔드·MySQL·Redis는 자체 호스트에서 **Docker Compose**로 운영하고,
백엔드는 **Cloudflare Tunnel**로 노출합니다.

```text
브라우저 → app.<도메인>  (Cloudflare Pages, frontend/dist)
         → api.<도메인>  (Cloudflare Tunnel → backend:8080)
                           backend → mysql / redis  (외부 비공개)
```

### 1. 백엔드 + DB + Redis

```bash
cp .env.prod.example .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### 2. Cloudflare Tunnel

Zero Trust → Tunnels: Public hostname `api.<도메인>` → `http://backend:8080`  
토큰을 `.env.prod`의 `CLOUDFLARE_TUNNEL_TOKEN`에 설정

### 3. Cloudflare Pages

| 항목 | 값 |
|------|-----|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| 환경변수 | `VITE_API_BASE_URL=https://api.<도메인>` |

SPA 라우팅용 `frontend/public/_redirects` 포함 (`/* /index.html 200`)
