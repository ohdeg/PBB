-- 직원 대타 신청 시 업주가 대타자를 나중에 지정할 수 있도록 허용
ALTER TABLE brew_shift_covers
    MODIFY COLUMN cover_user_id CHAR(36) NULL COMMENT '대타자 (직원 신청 직후에는 미지정)';

ALTER TABLE brew_shift_covers
    ADD CONSTRAINT chk_brew_cover_assignee
        CHECK (status NOT IN ('PENDING_COVER', 'APPROVED') OR cover_user_id IS NOT NULL);
