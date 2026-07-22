# PBB — Play beom's BAG

취미 앱을 모아 둔 **PBB** 플랫폼입니다.  
메인 브랜드는 **PBB (Play beom's BAG)** 이며, 홈에서 카테고리별 취미 앱으로 진입합니다.

## 현재 앱

| 앱 | 경로 | 설명 |
|----|------|------|
| iPBT | `/hobbies/ipbt` | 날씨를 보고 야구가 가능한지 보는 앱 |
| Brew Note | `/hobbies/brew-note` | 커피 레시피·테이스팅 노트 |
| Score Viewer | `/hobbies/score-viewer` | MusicXML/MXL 악보 보관함·연습 뷰어 (OSMD) |

공통 기능: 회원가입(약관 동의 포함) · 로그인 · JWT 인증 · PBB 스플래시 · 프로필

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Vite, React, TypeScript, Zustand, Axios, React Router, OpenSheetMusicDisplay, JSZip |
| Main Backend | Java 25, Spring Boot, Spring Security, JPA, Redis, Mail, R2(S3 API) |
| Analytics Backend | Python, FastAPI (스캐폴드) |
| Infra | MySQL 8, Redis 7, Docker Compose |

상세 설명: [`useskill.md`](useskill.md)

## 구조

```text
PBB/
├── frontend/              # Vite + React
├── spring_backend/        # Spring Boot API
├── fastAPI_backend/       # FastAPI (추후)
├── infra/mysql/           # init.sql, migrations
├── docker-compose.yml     # MySQL + Redis
└── useskill.md
```

```text
com.studiobs.spring_backend
├── global/     # config, security, exception, R2
└── domain/
    ├── auth/   # 회원가입·로그인·JWT·동의 카탈로그
    ├── user/   # User, UserConsent
    └── mail/
```

## 인증

- **Access Token** (30분): JSON Body → 프론트 Zustand **메모리**만 보관
- **Refresh Token** (7일): Redis `RT:{email}` + HttpOnly 쿠키
- 비밀번호: BCrypt
- 회원 ID: UUID (`CHAR(36)`)
- 회원가입 동의: `user_consents`에 항목·버전 저장  
  (필수: 이용약관 / 개인정보 / 만 14세 · 선택: 마케팅 · 특수 항목은 카탈로그 `enabled`로 확장)

## 주요 API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/auth/email/request` | 회원가입 이메일 코드 발송 |
| POST | `/api/v1/auth/email/verify` | 코드 검증 |
| POST | `/api/v1/auth/signup` | 회원가입 (+ 동의 목록) |
| POST | `/api/v1/auth/login` | 로그인 |
| POST | `/api/v1/auth/refresh` | Access Token 재발급 |
| POST | `/api/v1/auth/logout` | 로그아웃 |
| GET | `/api/v1/dev/r2/check` | R2 연결 점검 (`dev` 전용) |

## 로컬 실행

### 1. 인프라

```bash
docker compose up -d
```

| 서비스 | 포트 | 참고 |
|--------|------|------|
| MySQL | 3306 | DB `baseball_db` / user `baseball_user` / pw `baseball_password` |
| Redis | 6379 | 비밀번호 없음 |

기존 DB에 `user_consents`가 없으면:

```bash
docker exec -i baseball-mysql mysql -uroot -proot_password baseball_db \
  < infra/mysql/migrate_user_consents.sql
```

### 2. Spring Backend

```bash
cd spring_backend
cp .env.example .env   # 필요 시 R2·DB 등 채우기
./gradlew bootRun
```

- 기본 프로필: `dev` (인증 코드는 콘솔 mock 메일)
- API: `http://localhost:8080`
- `.env`는 `springboot4-dotenv`로 로드됩니다

운영:

```bash
export SPRING_PROFILES_ACTIVE=prod
./gradlew bootRun
```

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

프론트는 **Cloudflare Pages**, 백엔드·MySQL·Redis 는 자체 리눅스 호스트에서 **Docker Compose**로 운영하고,
백엔드는 **Cloudflare Tunnel**로 인터넷에 노출합니다 (포트포워딩·공인 IP·인증서 발급 불필요).

```text
브라우저 → app.<도메인>  (Cloudflare Pages, frontend/dist)
         → api.<도메인>  (Cloudflare Tunnel → 리눅스 backend:8080)
                           backend → mysql:3306 / redis:6379  (외부 비공개)
```

### 1. 백엔드 + DB + Redis (리눅스, Docker)

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # 재로그인

# 환경변수 준비
cp .env.prod.example .env.prod   # 값 채우기 (DB/Redis/JWT/CORS/COOKIE_SAME_SITE/Tunnel 토큰 등)

# 기동
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml ps   # 상태 확인
```

- `MYSQL_ROOT_PASSWORD` / `DB_PASSWORD` / `REDIS_PASSWORD` / `JWT_SECRET_KEY` 는 강한 랜덤값으로.
- `CORS_ALLOWED_ORIGINS=https://app.<도메인>`, `COOKIE_SAME_SITE=None` (도메인이 다를 때 필수).

### 2. Cloudflare Tunnel

Cloudflare 대시보드 → **Zero Trust → Networks → Tunnels → Create tunnel**:

1. 터널 생성 후 **Token** 을 `.env.prod` 의 `CLOUDFLARE_TUNNEL_TOKEN` 에 입력
2. Public hostname: `api.<도메인>` → Service `http://backend:8080`
3. DNS 는 자동 생성 → `https://api.<도메인>` 이 HTTPS 로 열림

### 3. 프론트엔드 (Cloudflare Pages)

Pages → Git 연결:

| 항목 | 값 |
|------|-----|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| 환경변수 | `VITE_API_BASE_URL=https://api.<도메인>` |

- 커스텀 도메인 `app.<도메인>` 연결
- SPA 라우팅용 `frontend/public/_redirects` 포함됨 (`/* /index.html 200`)

### 4. 검증

1. `https://api.<도메인>` 응답 확인
2. 프론트에서 로그인 → **F5 새로고침 후 로그인 유지되면 크로스도메인 쿠키 성공**
3. DevTools → Application → Cookies 에서 `refreshToken` 이 `Secure; SameSite=None` 인지 확인

## 보안 주의

- `.env`, 키·토큰, 인증서는 Git에 올리지 마세요 (`.gitignore`에 포함)
- 예제는 `*.env.example`만 커밋합니다
