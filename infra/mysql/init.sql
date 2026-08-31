-- =====================================================================
-- PBB 통합 초기 스키마 (운영/로컬 공통 단일 출처)
--   infra/mysql/migrate_*.sql 를 모두 적용한 최종 상태입니다.
--   빈 DB(신규 컨테이너)에서 한 번만 실행되어 전체 스키마를 생성합니다.
--   기존 DB 증분 변경은 각 migrate_*.sql 을 개별 적용하세요.
--   CHARSET=utf8mb4 / COLLATE=utf8mb4_unicode_ci / ENGINE=InnoDB
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '고유 식별자 (UUID)',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT '로그인 이메일 (아이디 역할)',
    password VARCHAR(60) NOT NULL COMMENT 'BCrypt 암호화된 비밀번호',
    nickname VARCHAR(50) NOT NULL UNIQUE COMMENT '서비스 내 활동 닉네임',
    user_class VARCHAR(16) NOT NULL DEFAULT 'FREE' COMMENT '회원 등급 (FREE, DEV)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '가입 일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '정보 수정 일시',

    INDEX idx_nickname (nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회원 정보 테이블';

CREATE TABLE IF NOT EXISTS user_consents (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '동의 기록 ID (UUID)',
    user_id CHAR(36) NOT NULL COMMENT '회원 ID',
    consent_key VARCHAR(64) NOT NULL COMMENT '동의 항목 키 (terms, privacy 등)',
    agreed TINYINT(1) NOT NULL COMMENT '동의 여부',
    version VARCHAR(32) NOT NULL COMMENT '동의 문서 버전',
    agreed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '동의 시각',

    CONSTRAINT fk_user_consents_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_consents_user_id (user_id),
    INDEX idx_user_consents_key (consent_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회원가입 약관·마케팅 동의 기록';

-- 전역 앱 설정 (key-value). dev가 관리. 현재 사용 키: featured_app_id (메인 상단 추천 앱)
CREATE TABLE IF NOT EXISTS app_config (
    config_key    VARCHAR(64)   NOT NULL PRIMARY KEY COMMENT '설정 키',
    config_value  VARCHAR(255)  NOT NULL COMMENT '설정 값',
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='전역 앱 설정 (dev 관리)';

-- 기본 추천 앱 (미설정 시 백엔드가 veveno로 폴백하므로 선택 사항)
INSERT INTO app_config (config_key, config_value)
VALUES ('featured_app_id', 'veveno')
ON DUPLICATE KEY UPDATE config_value = config_value;

-- Brew Note schema (Notion 기준)
-- 적용: mysql < migrate_brew_note.sql 또는 docker init 재실행

CREATE TABLE IF NOT EXISTS brew_stores (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '가게 ID (UUID)',
    owner_user_id CHAR(36) NOT NULL COMMENT '소유 회원',
    name VARCHAR(120) NOT NULL COMMENT '가게 이름',
    is_public TINYINT(1) NOT NULL DEFAULT 0 COMMENT '공개 여부',
    invite_code VARCHAR(8) NOT NULL COMMENT '가게 검색·공유 코드',
    stock_edit_off_duty TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1이면 재고권한 직원이 근무 외에도 재고 수정',
    stock_usage_hint TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1이면 사용량 일수 안내',
    call_bell_phrase VARCHAR(200) NULL COMMENT '호출벨 멘트',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_stores_owner
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_brew_stores_owner (owner_user_id),
    INDEX idx_brew_stores_public (is_public),
    UNIQUE KEY uk_brew_stores_invite_code (invite_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 가게';

CREATE TABLE IF NOT EXISTS brew_menus (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '메뉴 ID (UUID)',
    store_id CHAR(36) NOT NULL COMMENT '소속 가게',
    name VARCHAR(120) NOT NULL COMMENT '메뉴 이름',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_menus_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    INDEX idx_brew_menus_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 메뉴';

CREATE TABLE IF NOT EXISTS brew_recipes (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '레시피 ID (UUID)',
    menu_id CHAR(36) NOT NULL COMMENT '소속 메뉴',
    contents LONGTEXT NOT NULL COMMENT '레시피 JSON (method/beans/dose/...)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_recipes_menu
        FOREIGN KEY (menu_id) REFERENCES brew_menus(id) ON DELETE CASCADE,
    INDEX idx_brew_recipes_menu (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 레시피';

CREATE TABLE IF NOT EXISTS brew_store_subscriptions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    subscriber_user_id CHAR(36) NOT NULL COMMENT '구독 회원',
    store_id CHAR(36) NOT NULL COMMENT '구독 가게',
    can_edit_stock TINYINT(1) NOT NULL DEFAULT 0 COMMENT '재고 수정 권한',
    work_start_date DATE NULL COMMENT '근무 시작일(첫 근무일), 없으면 즉시 적용',
    leave_date DATE NULL COMMENT '퇴사일(마지막 근무일), 지나면 구독 해제',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_subs_user
        FOREIGN KEY (subscriber_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_subs_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    UNIQUE KEY uk_brew_subs_user_store (subscriber_user_id, store_id),
    INDEX idx_brew_subs_user (subscriber_user_id),
    INDEX idx_brew_subs_store (store_id),
    INDEX idx_brew_subs_work_start (work_start_date),
    INDEX idx_brew_subs_leave (leave_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 가게 구독';

CREATE TABLE IF NOT EXISTS brew_store_stock_categories (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    store_id CHAR(36) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_stock_cat_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    UNIQUE KEY uk_brew_stock_cat_name (store_id, category_name),
    INDEX idx_brew_stock_cat_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 재고 카테고리';

CREATE TABLE IF NOT EXISTS brew_store_stocks (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    stock_name VARCHAR(255) NOT NULL,
    stock_num INT NOT NULL DEFAULT 0,
    stock_min_num INT NULL DEFAULT 0,
    unit VARCHAR(16) NOT NULL DEFAULT '개' COMMENT '표시 단위',
    order_url VARCHAR(512) NULL COMMENT '발주 링크 http/https',
    version INT NOT NULL DEFAULT 0 COMMENT 'JPA @Version (낙관적 락)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_stocks_category
        FOREIGN KEY (category_id) REFERENCES brew_store_stock_categories(id) ON DELETE CASCADE,
    CONSTRAINT chk_brew_stock_num CHECK (stock_num >= 0),
    CONSTRAINT chk_brew_stock_min_num CHECK (stock_min_num IS NULL OR stock_min_num >= 0),
    UNIQUE KEY uk_brew_stock_name (category_id, stock_name),
    INDEX idx_brew_stocks_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 재고';

CREATE TABLE IF NOT EXISTS brew_store_stock_logs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    stock_id INT NOT NULL,
    user_id CHAR(36) NOT NULL,
    from_num INT NOT NULL,
    to_num INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_stock_log_stock
        FOREIGN KEY (stock_id) REFERENCES brew_store_stocks(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_stock_log_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_brew_stock_logs_stock (stock_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 재고 수량 변경 이력';

CREATE TABLE IF NOT EXISTS brew_store_stock_usage_days (
    stock_id INT NOT NULL,
    used_on DATE NOT NULL,
    qty INT NOT NULL DEFAULT 0,
    PRIMARY KEY (stock_id, used_on),
    CONSTRAINT fk_brew_usage_stock
        FOREIGN KEY (stock_id) REFERENCES brew_store_stocks(id) ON DELETE CASCADE,
    CONSTRAINT chk_brew_usage_qty CHECK (qty >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 재고 일별 사용량 (감소분 누적, +1 상쇄)';

CREATE TABLE IF NOT EXISTS brew_staff_schedules (
    id              CHAR(36)     NOT NULL PRIMARY KEY COMMENT '스케줄 ID (UUID)',
    store_id        CHAR(36)     NOT NULL COMMENT '가게 ID',
    user_id         CHAR(36)     NOT NULL COMMENT '직원(구독자) user ID',
    day_of_week     TINYINT      NOT NULL COMMENT '요일 1=월 .. 7=일 (ISO)',
    start_time      TIME         NOT NULL COMMENT '근무 시작',
    end_time        TIME         NOT NULL COMMENT '근무 종료 (start보다 작으면 자정 넘김)',
    effective_from  DATE         NOT NULL DEFAULT '1970-01-01' COMMENT '이 날짜부터 적용되는 주간 버전',
    active          TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0이면 이 날짜부터 해당 요일 근무 없음',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_sched_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_sched_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_brew_sched_dow
        CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_brew_sched_time_neq
        CHECK (end_time <> start_time),
    UNIQUE KEY uk_brew_sched_user_day_from (store_id, user_id, day_of_week, effective_from),
    INDEX idx_brew_sched_store (store_id),
    INDEX idx_brew_sched_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 직원 정규 근무(요일 반복 버전, 자정 넘김 허용)';

CREATE TABLE IF NOT EXISTS brew_staff_schedule_overrides (
    id              CHAR(36)     NOT NULL PRIMARY KEY COMMENT '하루 예외 ID (UUID)',
    store_id        CHAR(36)     NOT NULL COMMENT '가게 ID',
    user_id         CHAR(36)     NOT NULL COMMENT '직원 user ID',
    work_date       DATE         NOT NULL COMMENT '예외가 적용되는 하루',
    start_time      TIME         NULL COMMENT '근무 시작 (active=1일 때 필수)',
    end_time        TIME         NULL COMMENT '근무 종료 (start보다 작으면 자정 넘김)',
    active          TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0이면 그날만 휴무',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_sched_ov_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_sched_ov_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_brew_sched_ov_times
        CHECK (active = 0 OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time <> start_time)),
    UNIQUE KEY uk_brew_sched_ov_user_date (store_id, user_id, work_date),
    INDEX idx_brew_sched_ov_store_date (store_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='정규 근무 하루 예외(한번만 변경)';

CREATE TABLE IF NOT EXISTS brew_shift_covers (
    id                   CHAR(36)     NOT NULL PRIMARY KEY COMMENT '대타 ID (UUID)',
    store_id             CHAR(36)     NOT NULL COMMENT '가게 ID',
    original_user_id     CHAR(36)     NULL COMMENT '원래 근무자 (COVER만, EXTRA는 NULL)',
    cover_user_id        CHAR(36)     NULL COMMENT '대타/추가 근무자 (직원 대체 신청 직후에는 미지정)',
    work_date            DATE         NOT NULL COMMENT '대타/추가 시작일',
    start_time           TIME         NOT NULL COMMENT '시작',
    end_time             TIME         NOT NULL COMMENT '종료 (start보다 작으면 자정 넘김)',
    shift_kind           VARCHAR(16)  NOT NULL DEFAULT 'COVER' COMMENT 'COVER=대체 | EXTRA=추가',
    initiator_type       VARCHAR(16)  NOT NULL COMMENT 'EMPLOYEE | OWNER',
    requested_by_user_id CHAR(36)     NOT NULL COMMENT '신청자',
    status               VARCHAR(24)  NOT NULL COMMENT 'PENDING_OWNER | PENDING_COVER | APPROVED | REJECTED | CANCELLED',
    note                 VARCHAR(500) NULL COMMENT '메모',
    decided_by_user_id   CHAR(36)     NULL COMMENT '최종 승인자/거절자',
    decided_at           TIMESTAMP    NULL,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_cover_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_cover_original
        FOREIGN KEY (original_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_cover_cover
        FOREIGN KEY (cover_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_cover_requested
        FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_cover_decided
        FOREIGN KEY (decided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_brew_cover_initiator
        CHECK (initiator_type IN ('EMPLOYEE', 'OWNER')),
    CONSTRAINT chk_brew_cover_kind
        CHECK (shift_kind IN ('COVER', 'EXTRA')),
    CONSTRAINT chk_brew_cover_status
        CHECK (status IN (
            'PENDING_OWNER', 'PENDING_COVER',
            'APPROVED', 'REJECTED', 'CANCELLED'
        )),
    CONSTRAINT chk_brew_cover_assignee
        CHECK (status NOT IN ('PENDING_COVER', 'APPROVED') OR cover_user_id IS NOT NULL),
    CONSTRAINT chk_brew_cover_time_neq
        CHECK (end_time <> start_time),
    CONSTRAINT chk_brew_cover_original_by_kind
        CHECK (
            (shift_kind = 'COVER' AND original_user_id IS NOT NULL)
            OR (shift_kind = 'EXTRA' AND original_user_id IS NULL)
        ),
    CONSTRAINT chk_brew_cover_users
        CHECK (
            cover_user_id IS NULL
            OR original_user_id IS NULL
            OR original_user_id <> cover_user_id
        ),
    INDEX idx_brew_cover_store_date (store_id, work_date),
    INDEX idx_brew_cover_cover_date (cover_user_id, work_date),
    INDEX idx_brew_cover_original_date (original_user_id, work_date),
    INDEX idx_brew_cover_status (store_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 대타/추가 근무(날짜 단위, 자정 넘김 허용)';

CREATE TABLE IF NOT EXISTS brew_timer_presets (
    id                   CHAR(36)     NOT NULL PRIMARY KEY COMMENT '프리셋 ID (UUID)',
    scope                VARCHAR(16)  NOT NULL COMMENT 'PERSONAL | STORE',
    user_id              CHAR(36)     NULL COMMENT 'PERSONAL 소유자',
    store_id             CHAR(36)     NULL COMMENT 'STORE 소속 가게',
    created_by_user_id   CHAR(36)     NOT NULL COMMENT '생성자',
    name                 VARCHAR(120) NOT NULL COMMENT '프리셋 이름',
    steps                LONGTEXT     NOT NULL COMMENT 'JSON [{name, durationMs}]',
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_timer_preset_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_timer_preset_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_timer_preset_creator
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_brew_timer_preset_scope
        CHECK (
            (scope = 'PERSONAL' AND user_id IS NOT NULL AND store_id IS NULL)
            OR (scope = 'STORE' AND store_id IS NOT NULL AND user_id IS NULL)
        ),
    INDEX idx_brew_timer_preset_user (user_id),
    INDEX idx_brew_timer_preset_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 타이머 프리셋 (개인/가게 공용)';

CREATE TABLE IF NOT EXISTS brew_pos_devices (
    id                  CHAR(36)     NOT NULL PRIMARY KEY COMMENT '행 ID (UUID)',
    store_id            CHAR(36)     NOT NULL COMMENT '소속 가게',
    device_id           VARCHAR(64)  NOT NULL COMMENT 'POS 브라우저 기기 ID',
    enrolled_by_user_id CHAR(36)     NOT NULL COMMENT '최초 등록한 업주',
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_pos_device_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_pos_device_enrolled
        FOREIGN KEY (enrolled_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_brew_pos_store_device (store_id, device_id),
    INDEX idx_brew_pos_store (store_id),
    INDEX idx_brew_pos_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno POS 등록 기기 화이트리스트';

CREATE TABLE IF NOT EXISTS brew_store_notices (
    id                CHAR(36)      NOT NULL PRIMARY KEY COMMENT '공지 ID (UUID)',
    store_id          CHAR(36)      NOT NULL COMMENT '가게 ID',
    author_user_id    CHAR(36)      NOT NULL COMMENT '작성자 (owner)',
    title             VARCHAR(200)  NOT NULL COMMENT '제목',
    body              TEXT          NOT NULL COMMENT '본문',
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_notice_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_notice_author
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_brew_notice_store_created (store_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 가게 공지';

CREATE TABLE IF NOT EXISTS brew_checklist_templates (
    id              CHAR(36)      NOT NULL PRIMARY KEY COMMENT '체크리스트 ID',
    store_id        CHAR(36)      NOT NULL COMMENT '가게 ID',
    owner_user_id   CHAR(36)      NULL COMMENT 'NULL=가게, 있으면 개인',
    title           VARCHAR(120)  NOT NULL COMMENT '이름',
    trigger_type    VARCHAR(16)   NOT NULL COMMENT 'CLOCK|SHIFT_START|SHIFT_END|MANUAL',
    trigger_time    TIME          NULL COMMENT 'CLOCK 시각',
    trigger_dows    VARCHAR(32)   NULL COMMENT '월=1..일=7 콤마. NULL이면 매일',
    audience        VARCHAR(16)   NOT NULL DEFAULT 'ON_DUTY' COMMENT 'ON_DUTY|OWNER_ONLY',
    interrupt       TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '1이면 들어오면 바로 열기',
    enabled         TINYINT(1)    NOT NULL DEFAULT 1,
    sort_order      INT           NOT NULL DEFAULT 0,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_checklist_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_checklist_owner
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_brew_checklist_trigger
        CHECK (trigger_type IN ('CLOCK', 'SHIFT_START', 'SHIFT_END', 'MANUAL')),
    CONSTRAINT chk_brew_checklist_audience
        CHECK (audience IN ('ON_DUTY', 'OWNER_ONLY')),
    INDEX idx_brew_checklist_store_owner (store_id, owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 체크리스트 템플릿';

CREATE TABLE IF NOT EXISTS brew_checklist_items (
    id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    template_id  CHAR(36)     NOT NULL,
    body         VARCHAR(200) NOT NULL,
    sort_order   INT          NOT NULL DEFAULT 0,

    CONSTRAINT fk_brew_checklist_item_tmpl
        FOREIGN KEY (template_id) REFERENCES brew_checklist_templates(id) ON DELETE CASCADE,
    INDEX idx_brew_checklist_item_tmpl (template_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 체크리스트 항목';

CREATE TABLE IF NOT EXISTS brew_checklist_runs (
    id           CHAR(36)  NOT NULL PRIMARY KEY,
    template_id  CHAR(36)  NOT NULL,
    run_on       DATE      NOT NULL COMMENT '서울 날짜',
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_checklist_run_tmpl
        FOREIGN KEY (template_id) REFERENCES brew_checklist_templates(id) ON DELETE CASCADE,
    UNIQUE KEY uk_brew_checklist_run (template_id, run_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 체크리스트 하루 회차';

CREATE TABLE IF NOT EXISTS brew_checklist_checks (
    run_id      CHAR(36)  NOT NULL,
    item_id     INT       NOT NULL,
    user_id     CHAR(36)  NOT NULL,
    checked_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (run_id, item_id),

    CONSTRAINT fk_brew_checklist_check_run
        FOREIGN KEY (run_id) REFERENCES brew_checklist_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_checklist_check_item
        FOREIGN KEY (item_id) REFERENCES brew_checklist_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_checklist_check_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 체크리스트 항목 체크';

-- Lotto schema (Firebase lotto/drawHistory + userPicks → MySQL)
-- 적용: docker exec -i baseball-mysql mysql -uroot -proot_password baseball_db < migrate_lotto.sql

CREATE TABLE IF NOT EXISTS lotto_draws (
    round INT NOT NULL PRIMARY KEY COMMENT '회차',
    main_numbers VARCHAR(32) NOT NULL COMMENT '본번호 6개 (콤마 구분, 오름차순)',
    bonus_number TINYINT NULL COMMENT '보너스 번호',
    draw_date DATE NULL COMMENT '추첨일',
    first_prize_amount BIGINT NULL COMMENT '1등 1인당 당첨금(세전)',
    first_prize_winner_count INT NULL COMMENT '1등 당첨자 수',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_lotto_draws_date (draw_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='로또 회차별 당첨 번호';

CREATE TABLE IF NOT EXISTS lotto_user_picks (
    user_id CHAR(36) NOT NULL PRIMARY KEY COMMENT '회원 UUID',
    target_round INT NULL COMMENT '목표 회차',
    items JSON NOT NULL COMMENT '생성 번호 히스토리 (최대 200)',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_lotto_picks_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='회원별 로또 번호 생성 히스토리';

-- Dieta (hobby) — Phase 1 BE + FE stub share this schema
CREATE TABLE IF NOT EXISTS dieta_profiles (
    user_id                  CHAR(36)       NOT NULL PRIMARY KEY COMMENT 'FK users.id',
    height_cm                DECIMAL(5,1)   NOT NULL,
    goal_type                VARCHAR(16)    NOT NULL COMMENT 'LOSS|GAIN|MAINTAIN',
    last_non_maintain_goal_type VARCHAR(16) NOT NULL DEFAULT 'LOSS' COMMENT 'LOSS|GAIN remembered for maintain toggle OFF',
    weekly_target_kg         DECIMAL(4,2)   NOT NULL DEFAULT 0,
    target_weight_kg         DECIMAL(5,2)   NULL COMMENT 'goal body weight; switch to MAINTAIN on reach',
    weekly_effective_kg      DECIMAL(4,2)   NULL COMMENT 'W×0.9 internal (legacy/alias)',
    weekly_body_fat_loss_kg  DECIMAL(4,2)   NULL COMMENT 'LOSS derived W×0.9',
    weekly_muscle_gain_kg    DECIMAL(4,2)   NULL COMMENT 'GAIN derived W×0.9',
    intensity_preference     VARCHAR(16)    NULL COMMENT 'BOOST|HOLD',
    bmr_kcal                 INT            NOT NULL,
    bmr_source               VARCHAR(16)    NOT NULL COMMENT 'USER_ENTERED|ESTIMATED',
    activity_factor          DECIMAL(4,2)   NOT NULL,
    tdee_kcal                INT            NOT NULL,
    daily_kcal               INT            NOT NULL,
    diet_style               VARCHAR(16)    NOT NULL,
    macros_json              JSON           NOT NULL COMMENT '{carbPct,proteinPct,fatPct}',
    macros_customized        TINYINT(1)     NOT NULL DEFAULT 0,
    diet_baseline_method     VARCHAR(16)    NULL COMMENT 'SURVEY|DIARY_5D',
    loss_initial_deficit_kcal INT           NOT NULL DEFAULT 400,
    gain_initial_surplus_kcal INT           NOT NULL DEFAULT 250,
    loss_cut_kcal            INT            NOT NULL DEFAULT 175,
    loss_recover_kcal        INT            NOT NULL DEFAULT 150,
    loss_activity_kcal       INT            NOT NULL DEFAULT 150,
    gain_surplus_kcal        INT            NOT NULL DEFAULT 250,
    gain_cut_kcal            INT            NOT NULL DEFAULT 175,
    gain_ceiling_delta_kcal  INT            NOT NULL DEFAULT 500,
    gemini_meal_consent      TINYINT(1)     NOT NULL DEFAULT 0,
    week_starts_on           DATE           NOT NULL,
    week_activity_extra_kcal INT            NOT NULL DEFAULT 0,
    onboarding_complete      TINYINT(1)     NOT NULL DEFAULT 0,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 프로필·주간 코칭 설정';

CREATE TABLE IF NOT EXISTS dieta_body_logs (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL,
    weight_kg                DECIMAL(5,2)   NULL,
    body_fat_mass_kg         DECIMAL(5,2)   NULL COMMENT 'unused in MVP (weight-only)',
    skeletal_muscle_mass_kg  DECIMAL(5,2)   NULL COMMENT 'unused in MVP (weight-only)',
    fasted                   TINYINT(1)     NOT NULL DEFAULT 1,
    source                   VARCHAR(16)    NOT NULL COMMENT 'DAILY_FASTED|ONBOARDING|CHECK_IN|MANUAL',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_body_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_dieta_body_user_day (user_id, logged_on),
    INDEX idx_dieta_body_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 체중 로그 (체지방/골격근 컬럼은 예약, MVP 미사용)';

CREATE TABLE IF NOT EXISTS dieta_intake_logs (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL,
    carb_g                   DECIMAL(7,1)   NOT NULL DEFAULT 0,
    protein_g                DECIMAL(7,1)   NOT NULL DEFAULT 0,
    fat_g                    DECIMAL(7,1)   NOT NULL DEFAULT 0,
    kcal                     INT            NOT NULL COMMENT 'from Gemini totals or macros formula',
    review                   TEXT           NULL COMMENT 'Gemini one-line diet review',
    source_meals_json        JSON           NULL COMMENT 'queue meals + queueTotals + recipeIds[] + knownRecipes audit',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_intake_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_dieta_intake_user_day (user_id, logged_on),
    INDEX idx_dieta_intake_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 일별 섭취(마감 Gemini 결과). 낮 큐는 Redis';

CREATE TABLE IF NOT EXISTS dieta_recipes (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL COMMENT 'day-scoped; no bookshelf yet',
    meal_type                VARCHAR(16)    NULL COMMENT 'BREAKFAST|LUNCH|DINNER|SNACK; null on create until add-to-day',
    title                    VARCHAR(200)   NOT NULL,
    ingredients_json         JSON           NOT NULL COMMENT 'string[] ingredient lines',
    steps                    TEXT           NULL,
    carb_g                   DECIMAL(7,1)   NOT NULL DEFAULT 0 COMMENT 'per 1 serving',
    protein_g                DECIMAL(7,1)   NOT NULL DEFAULT 0 COMMENT 'per 1 serving',
    fat_g                    DECIMAL(7,1)   NOT NULL DEFAULT 0 COMMENT 'per 1 serving',
    kcal                     INT            NOT NULL COMMENT 'per 1 serving',
    one_line_review          TEXT           NULL,
    servings                 DECIMAL(6,2)   NOT NULL DEFAULT 1.00 COMMENT 'batch servings at create; macros are per 1 serving',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_recipes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_dieta_recipes_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 당일 레시피 분석 결과 (logged_on 스코프; macros per serving)';

CREATE TABLE IF NOT EXISTS dieta_activity_logs (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL,
    steps                    INT            NULL,
    duration_min             INT            NULL,
    activity_kcal            INT            NULL,
    note                     VARCHAR(255)   NULL,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_activity_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_dieta_activity_user_day (user_id, logged_on),
    INDEX idx_dieta_activity_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 일별 활동량';

CREATE TABLE IF NOT EXISTS dieta_keto_events (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    recorded_at              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ease_requested           TINYINT(1)     NOT NULL DEFAULT 0,

    CONSTRAINT fk_dieta_keto_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_dieta_keto_user_time (user_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 키토플루 이벤트';

CREATE TABLE IF NOT EXISTS dieta_check_in_logs (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL,
    weight_kg                DECIMAL(5,2)   NULL,
    baseline_weight_kg       DECIMAL(5,2)   NULL,
    weight_delta_kg          DECIMAL(5,2)   NULL,
    keep_targets             TINYINT(1)     NOT NULL DEFAULT 0 COMMENT 'true=keep daily/W/activity; ignore weight X',
    applied_daily_kcal       INT            NOT NULL,
    applied_activity_extra_kcal INT         NOT NULL DEFAULT 0,
    applied_weekly_target_kg DECIMAL(4,2)   NOT NULL DEFAULT 0,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_check_in_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_dieta_check_in_user_day (user_id, logged_on),
    INDEX idx_dieta_check_in_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 주간 체크인 확정 로그 (apply API Phase 2+)';

-- Sranko (슈란코) hobby
CREATE TABLE IF NOT EXISTS sranko_prefs (
    user_id                  CHAR(36)       NOT NULL PRIMARY KEY COMMENT 'FK users.id',
    try_on_consent           TINYINT(1)     NOT NULL DEFAULT 0,
    sex                      CHAR(1)        NULL COMMENT 'M|F; null treats as M for default mannequin',
    body_measurements_json   JSON           NOT NULL COMMENT 'lengths cm, weight kg, shoeSize mm',
    places_json              JSON           NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '[{id,label,kind:HOME|WORK|FAVORITE,lat,lon,query?}]',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_prefs_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 사용자 설정·성별·신체 사이즈';

CREATE TABLE IF NOT EXISTS sranko_items (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    slot                     VARCHAR(16)    NOT NULL COMMENT 'TOP|BOTTOM|OUTER|SHOES|DRESS|BAG|HAT|JEWELRY',
    category_code            VARCHAR(64)    NOT NULL,
    warmth                   TINYINT        NULL COMMENT 'warmth 1-5; NULL for shoes / unset',
    name                     VARCHAR(120)   NOT NULL,
    brand                    VARCHAR(80)    NULL COMMENT '브랜드 (선택)',
    product_url              VARCHAR(512)   NULL COMMENT '상품 URL http(s) (선택)',
    image_url                VARCHAR(512)   NOT NULL COMMENT 'R2 public URL',
    measurements_json        JSON           NOT NULL COMMENT '{} or measurement map',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_items_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sranko_items_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 옷장 아이템';

CREATE TABLE IF NOT EXISTS sranko_looks (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    name                     VARCHAR(120)   NOT NULL,
    image_url                VARCHAR(512)   NOT NULL COMMENT 'R2 public URL',
    item_ids_json            JSON           NOT NULL COMMENT 'UUID[] of sranko_items',
    source                   VARCHAR(16)    NOT NULL COMMENT 'COMPOSE|TRY_ON',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_looks_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sranko_looks_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 룩 (입어보기·합성 결과)';

CREATE TABLE IF NOT EXISTS sranko_posts (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    author_user_id           CHAR(36)       NOT NULL,
    subject                  VARCHAR(200)   NOT NULL,
    content                  TEXT           NOT NULL,
    image_url                VARCHAR(512)   NOT NULL COMMENT 'R2 public URL (cover / first)',
    image_urls               JSON           NOT NULL COMMENT 'string[] R2 public URLs (1–10)',
    read_count               INT            NOT NULL DEFAULT 0,
    like_count               INT            NOT NULL DEFAULT 0,
    comment_count            INT            NOT NULL DEFAULT 0,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_posts_author
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sranko_posts_created (created_at),
    INDEX idx_sranko_posts_reads (read_count),
    INDEX idx_sranko_posts_author (author_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 커뮤니티 게시글';

CREATE TABLE IF NOT EXISTS sranko_post_likes (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    post_id                  CHAR(36)       NOT NULL,
    user_id                  CHAR(36)       NOT NULL,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_post_likes_post
        FOREIGN KEY (post_id) REFERENCES sranko_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_sranko_post_likes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sranko_post_likes_post_user (post_id, user_id),
    INDEX idx_sranko_post_likes_user_post (user_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 게시글 좋아요';

CREATE TABLE IF NOT EXISTS sranko_post_comments (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    post_id                  CHAR(36)       NOT NULL,
    author_user_id           CHAR(36)       NOT NULL,
    parent_id                CHAR(36)       NULL COMMENT 'NULL=root; non-null must point to root comment',
    body                     VARCHAR(500)   NOT NULL,
    like_count               INT            NOT NULL DEFAULT 0,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_post_comments_post
        FOREIGN KEY (post_id) REFERENCES sranko_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_sranko_post_comments_author
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sranko_post_comments_parent
        FOREIGN KEY (parent_id) REFERENCES sranko_post_comments(id) ON DELETE CASCADE,
    INDEX idx_sranko_post_comments_post_created (post_id, created_at),
    INDEX idx_sranko_post_comments_parent (post_id, parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 게시 댓글·대댓글(2단)';

CREATE TABLE IF NOT EXISTS sranko_post_comment_likes (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    comment_id               CHAR(36)       NOT NULL,
    user_id                  CHAR(36)       NOT NULL,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_post_comment_likes_comment
        FOREIGN KEY (comment_id) REFERENCES sranko_post_comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_sranko_post_comment_likes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sranko_comment_likes_comment_user (comment_id, user_id),
    INDEX idx_sranko_comment_likes_user_comment (user_id, comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 댓글 좋아요';
