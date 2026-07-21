-- 가게 초대/검색 코드 (동명 구분 · 비공개 초대)
ALTER TABLE brew_stores
    ADD COLUMN invite_code VARCHAR(8) NULL COMMENT '가게 검색·공유 코드' AFTER is_public;

UPDATE brew_stores
SET invite_code = UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))
WHERE invite_code IS NULL;

ALTER TABLE brew_stores
    MODIFY COLUMN invite_code VARCHAR(8) NOT NULL COMMENT '가게 검색·공유 코드';

ALTER TABLE brew_stores
    ADD UNIQUE KEY uk_brew_stores_invite_code (invite_code);
