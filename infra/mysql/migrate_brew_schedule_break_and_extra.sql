-- 정규 근무 휴식 + 대타/추가 근무 구분
ALTER TABLE brew_staff_schedules
    ADD COLUMN has_break TINYINT(1) NOT NULL DEFAULT 0 COMMENT '휴식 여부' AFTER end_time,
    ADD COLUMN break_start_time TIME NULL COMMENT '휴식 시작' AFTER has_break,
    ADD COLUMN break_end_time TIME NULL COMMENT '휴식 종료' AFTER break_start_time;

ALTER TABLE brew_staff_schedules
    ADD CONSTRAINT chk_brew_sched_break
        CHECK (
            (has_break = 0 AND break_start_time IS NULL AND break_end_time IS NULL)
            OR (has_break = 1 AND break_start_time IS NOT NULL AND break_end_time IS NOT NULL
                AND break_start_time <> break_end_time)
        );

ALTER TABLE brew_shift_covers
    ADD COLUMN shift_kind VARCHAR(16) NOT NULL DEFAULT 'COVER'
        COMMENT 'COVER=대체 | EXTRA=추가' AFTER end_time;

ALTER TABLE brew_shift_covers
    ADD CONSTRAINT chk_brew_cover_kind
        CHECK (shift_kind IN ('COVER', 'EXTRA'));
