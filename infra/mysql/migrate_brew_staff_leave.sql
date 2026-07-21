-- 직원 퇴사 예정일 (마지막 근무일). 지나면 구독·근무 정리.
ALTER TABLE brew_store_subscriptions
    ADD COLUMN leave_date DATE NULL COMMENT '퇴사일(마지막 근무일), 지나면 구독 해제' AFTER can_edit_stock;

ALTER TABLE brew_store_subscriptions
    ADD INDEX idx_brew_subs_leave (leave_date);
