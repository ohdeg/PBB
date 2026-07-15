# PBB 기능별 유저 흐름도

기준: 현재 프론트엔드 라우트·화면 구현 (`frontend/src`)  
FigJam: [PBB 유저 흐름도](https://www.figma.com/board/7VmuTicHtscXPF1VJ91B9J/PBB-%EC%9C%A0%EC%A0%80-%ED%9D%90%EB%A6%84%EB%8F%84)

> FigJam은 Design처럼 페이지가 없어 **기능별 섹션**으로 분리해 두었습니다.  
> 좌측 레이어/섹션 목록에서 `0.~7.` 섹션을 클릭하면 해당 흐름으로 이동합니다.

> 취미 앱(Analyze Baseball / Brew Note / Score Viewer)은 **비로그인 진입 가능**.  
> **프로필**만 Access Token 필요 (없으면 `/login` 리다이렉트).

---

## 0. 앱 부트 · 전체 맵

```mermaid
flowchart LR
    start([앱 실행]) --> splash[부트 스플래시]
    splash --> boot[bootstrapAuth]
    boot --> ready[앱 준비 완료]
    ready --> home[홈]

    home --> baseball[Analyze Baseball]
    home --> brew[Brew Note]
    home --> score[Score Viewer]
    home --> authCheck{로그인 상태?}
    authCheck -->|"비로그인"| loginEntry[로그인 / 회원가입]
    authCheck -->|"로그인"| profileEntry[프로필 / 로그아웃]
```

---

## 1. 회원가입 `/signup`

```mermaid
flowchart LR
    start([회원가입]) --> nick[닉네임 입력]
    nick -->|"유효"| emailStep[이메일 입력]
    emailStep --> sendCode[인증 코드 발송]
    sendCode --> verifyCode[코드 확인]
    verifyCode -->|"실패"| emailStep
    verifyCode -->|"성공"| pwd[비밀번호 + 확인]
    pwd -->|"유효·일치"| consent[약관 동의]
    consent -->|"필수 미동의"| consent
    consent -->|"필수 동의"| signupApi[회원가입 API]
    signupApi -->|"성공"| loginPage([로그인 페이지])
    signupApi -->|"실패"| consent
```

단계: 닉네임 → 이메일 인증 → 비밀번호 → 약관 동의 → 완료 후 `/login`

---

## 2. 로그인 `/login`

```mermaid
flowchart LR
    start([로그인]) --> form[이메일 + 비밀번호]
    form -->|"유효성 실패"| start
    form -->|"성공"| store[Access Token 메모리 저장]
    store --> home([홈])
    start -.-> signup[회원가입]
    start -.-> findEmail[이메일 찾기]
    start -.-> resetPw[비밀번호 재설정]
```

---

## 3. 이메일 찾기 `/find-email`

```mermaid
flowchart LR
    start([이메일 찾기]) --> nick[닉네임 입력]
    nick -->|"성공"| masked[마스킹 이메일 표시]
    nick -->|"실패"| err[계정 없음]
    start -.-> login[로그인]
    start -.-> resetPw[비밀번호 재설정]
```

---

## 4. 비밀번호 재설정 `/reset-password`

```mermaid
flowchart LR
    start([비밀번호 재설정]) --> emailStep[이메일 입력]
    emailStep --> sendCode[인증 코드 발송]
    sendCode --> verify[코드 확인]
    verify -->|"이메일 변경"| emailStep
    verify -->|"성공"| newPwd[새 비밀번호 + 확인]
    newPwd -->|"성공"| loginPage([로그인 페이지])
    newPwd -->|"실패"| newPwd
```

단계: 이메일 → 코드 검증 → 새 비밀번호 → `/login`

---

## 4-1. 비밀번호 변경 (로그인) `/profile/change-password`

FigJam **3-1. 비밀번호 변경** — 로그인된 사용자 전용. 비로그인 `/reset-password`와 별개.

```mermaid
flowchart LR
    start([비밀번호 변경]) --> emailAuth[이메일 인증]
    emailAuth -->|"실패"| emailAuth
    emailAuth -->|"성공"| newPwd[새로운 비밀번호 입력]
    newPwd --> compare[현재 비밀번호와 비교]
    compare -->|"일치=동일 비번"| newPwd
    compare -->|"불일치=다른 비번"| change[비밀번호 변경 처리]
    change --> logout[로그아웃]
    logout --> login([로그인 페이지])
```

단계: 프로필 → 이메일 인증 → 새 비밀번호 → 서버 동일 비번 거부 → 변경 후 `clearAuth` → `/login`

---

## 5. 프로필 · 로그아웃 `/profile`

```mermaid
flowchart LR
    nickClick[헤더 닉네임] --> hasToken{Access Token?}
    hasToken -->|"없음"| login([로그인])
    hasToken -->|"있음"| profile[프로필 조회]
    profile --> logout[로그아웃]
    logout --> clear[clearAuth]
    clear --> home([홈])
    profile --> changePw[비밀번호 변경]
    changePw --> changePwPage(["/profile/change-password"])
    profile --> homeLink[메인]
    profile --> baseballLink[Analyze Baseball]
```

헤더에서도 로그아웃 가능 (로그아웃 후 현재 페이지 유지).

---

## 6. 홈 → 취미 앱 진입

```mermaid
flowchart LR
    home([홈]) --> featured[추천 Analyze Baseball]
    home --> sports[스포츠]
    home --> life[라이프]
    home --> music[음악]
    featured --> baseball[/hobbies/analyze-baseball]
    sports --> baseball
    life --> brew[/hobbies/brew-note]
    music --> score[/hobbies/score-viewer]
```

---

## 7. Analyze Baseball

```mermaid
flowchart LR
    enter([진입]) --> board[분석 보드]
    board --> empty[표시할 데이터 없음]
    enter --> back[메인]
```

현재 UI 스캐폴드 단계.

---

## 8. Brew Note

```mermaid
flowchart LR
    enter([진입]) --> list{레시피 목록}
    list -->|"비어 있음"| empty[저장된 레시피 없음]
    list -->|"있음"| select[레시피 선택]
    select --> detail[상세 스펙·노트]
    enter --> back[메인]
```

`BREW_RECIPES`가 비어 있으면 empty 상태만 표시.

---

## 9. Score Viewer

```mermaid
flowchart LR
    enter([진입]) --> openFile[악보 파일 열기]
    openFile --> check{musicxml / mxl?}
    check -->|"아니오"| err[에러 메시지]
    check -->|"예"| render[OSMD 렌더]
    render --> play[재생 / 일시정지]
    render --> metronome[메트로놈·BPM]
    render --> transpose[조옮김]
    render --> measure[마디 이동·하이라이트]
    render --> scroll[자동 스크롤]
    render --> closeScore[닫기]
    enter --> back[메인]
```

---

## 10. 세션 유지 (백그라운드)

```mermaid
flowchart LR
    api401[API 401] --> refresh[Refresh Token으로 재발급]
    refresh -->|"성공"| retry[원요청 재시도]
    refresh -->|"실패"| clear[clearAuth]
```

---

## 라우트 요약

| 경로 | 기능 | 인증 |
|------|------|------|
| `/` | 홈 · 취미 앱 스토어 | 선택 |
| `/signup` | 회원가입 | 불필요 |
| `/login` | 로그인 | 불필요 |
| `/find-email` | 이메일 찾기 | 불필요 |
| `/reset-password` | 비밀번호 재설정 | 불필요 |
| `/profile` | 프로필 · 로그아웃 | **필수** |
| `/profile/change-password` | 비밀번호 변경 (로그인) | **필수** |
| `/hobbies/analyze-baseball` | 야구 분석 | 선택 |
| `/hobbies/brew-note` | 커피 레시피 | 선택 |
| `/hobbies/score-viewer` | 악보 뷰어 | 선택 |
