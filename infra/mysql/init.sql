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
-- Brew Note schema (Notion 기준)
-- 적용: mysql < migrate_brew_note.sql 또는 docker init 재실행

CREATE TABLE IF NOT EXISTS brew_stores (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '가게 ID (UUID)',
    owner_user_id CHAR(36) NOT NULL COMMENT '소유 회원',
    name VARCHAR(120) NOT NULL COMMENT '가게 이름',
    is_public TINYINT(1) NOT NULL DEFAULT 0 COMMENT '공개 여부',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_stores_owner
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_brew_stores_owner (owner_user_id),
    INDEX idx_brew_stores_public (is_public)
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_subs_user
        FOREIGN KEY (subscriber_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_subs_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    UNIQUE KEY uk_brew_subs_user_store (subscriber_user_id, store_id),
    INDEX idx_brew_subs_user (subscriber_user_id),
    INDEX idx_brew_subs_store (store_id)
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

CREATE TABLE IF NOT EXISTS brew_staff_schedules (
    id              CHAR(36)     NOT NULL PRIMARY KEY COMMENT '스케줄 ID (UUID)',
    store_id        CHAR(36)     NOT NULL COMMENT '가게 ID',
    user_id         CHAR(36)     NOT NULL COMMENT '직원(구독자) user ID',
    day_of_week     TINYINT      NOT NULL COMMENT '요일 1=월 .. 7=일 (ISO)',
    start_time      TIME         NOT NULL COMMENT '근무 시작',
    end_time        TIME         NOT NULL COMMENT '근무 종료 (start보다 작으면 자정 넘김)',
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
    UNIQUE KEY uk_brew_sched_user_day (store_id, user_id, day_of_week),
    INDEX idx_brew_sched_store (store_id),
    INDEX idx_brew_sched_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 직원 정규 근무(요일 반복, 자정 넘김 허용)';

CREATE TABLE IF NOT EXISTS brew_shift_covers (
    id                   CHAR(36)     NOT NULL PRIMARY KEY COMMENT '대타 ID (UUID)',
    store_id             CHAR(36)     NOT NULL COMMENT '가게 ID',
    original_user_id     CHAR(36)     NOT NULL COMMENT '원래 근무자',
    cover_user_id        CHAR(36)     NULL COMMENT '대타자 (직원 신청 직후에는 미지정)',
    work_date            DATE         NOT NULL COMMENT '대타 시작일',
    start_time           TIME         NOT NULL COMMENT '대타 시작',
    end_time             TIME         NOT NULL COMMENT '대타 종료 (start보다 작으면 자정 넘김)',
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
    CONSTRAINT chk_brew_cover_status
        CHECK (status IN (
            'PENDING_OWNER', 'PENDING_COVER',
            'APPROVED', 'REJECTED', 'CANCELLED'
        )),
    CONSTRAINT chk_brew_cover_assignee
        CHECK (status NOT IN ('PENDING_COVER', 'APPROVED') OR cover_user_id IS NOT NULL),
    CONSTRAINT chk_brew_cover_time_neq
        CHECK (end_time <> start_time),
    CONSTRAINT chk_brew_cover_users
        CHECK (original_user_id <> cover_user_id),
    INDEX idx_brew_cover_store_date (store_id, work_date),
    INDEX idx_brew_cover_cover_date (cover_user_id, work_date),
    INDEX idx_brew_cover_original_date (original_user_id, work_date),
    INDEX idx_brew_cover_status (store_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 대타(날짜 단위, 자정 넘김 허용)';

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
