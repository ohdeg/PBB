-- Weekly schedule versions + one-day overrides
ALTER TABLE brew_staff_schedules
    ADD COLUMN effective_from DATE NOT NULL DEFAULT '1970-01-01'
        COMMENT '이 날짜부터 적용되는 주간 버전' AFTER end_time,
    ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1
        COMMENT '0이면 이 날짜부터 해당 요일 근무 없음' AFTER effective_from;

ALTER TABLE brew_staff_schedules
    DROP INDEX uk_brew_sched_user_day,
    ADD UNIQUE KEY uk_brew_sched_user_day_from (store_id, user_id, day_of_week, effective_from);

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
