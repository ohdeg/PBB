-- EXTRA(추가 근무): original_user_id 없음. COVER만 원래 근무자 필수.
ALTER TABLE brew_shift_covers
    DROP CHECK chk_brew_cover_users;

ALTER TABLE brew_shift_covers
    MODIFY COLUMN original_user_id CHAR(36) NULL COMMENT '원래 근무자 (COVER만, EXTRA는 NULL)';

-- 기존 EXTRA 행은 추가 근무자(cover)만 남기고 original 제거
UPDATE brew_shift_covers
SET original_user_id = NULL
WHERE shift_kind = 'EXTRA';

ALTER TABLE brew_shift_covers
    ADD CONSTRAINT chk_brew_cover_original_by_kind
        CHECK (
            (shift_kind = 'COVER' AND original_user_id IS NOT NULL)
            OR (shift_kind = 'EXTRA' AND original_user_id IS NULL)
        );

ALTER TABLE brew_shift_covers
    ADD CONSTRAINT chk_brew_cover_users
        CHECK (
            cover_user_id IS NULL
            OR original_user_id IS NULL
            OR original_user_id <> cover_user_id
        );
