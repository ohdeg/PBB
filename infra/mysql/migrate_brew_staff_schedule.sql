-- Brew Note: 직원 정규 근무 + 대타
-- 적용: docker exec -i baseball-mysql mysql -uroot -proot_password baseball_db < migrate_brew_staff_schedule.sql
-- 자정 넘김: end_time < start_time 이면 다음날 종료로 해석 (end == start 금지)

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
    cover_user_id        CHAR(36)     NOT NULL COMMENT '대타자',
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
