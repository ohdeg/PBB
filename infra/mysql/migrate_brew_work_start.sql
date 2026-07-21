-- 직원 근무 시작일. 이 날짜 전부터는 정규 근무 달력·근무 중 판정에 나오지 않음.
ALTER TABLE brew_store_subscriptions
    ADD COLUMN work_start_date DATE NULL COMMENT '근무 시작일(첫 근무일), 없으면 즉시 적용' AFTER can_edit_stock;

ALTER TABLE brew_store_subscriptions
    ADD INDEX idx_brew_subs_work_start (work_start_date);
