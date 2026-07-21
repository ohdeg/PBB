-- 정규 근무 휴식 필드 제거
ALTER TABLE brew_staff_schedules
    DROP CHECK chk_brew_sched_break;

ALTER TABLE brew_staff_schedules
    DROP COLUMN has_break,
    DROP COLUMN break_start_time,
    DROP COLUMN break_end_time;
