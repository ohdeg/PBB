SET NAMES utf8mb4;

-- migrate_brew_stock_meta.sql 을 latin1/cp1252 클라이언트로 적용하면
-- 기본값 '개'(EA B0 9C)가 'ê°œ'로 저장됨. 이미 깨진 행만 되돌린다.
UPDATE brew_store_stocks
SET unit = '개'
WHERE HEX(unit) = 'C3AAC2B0C593';

ALTER TABLE brew_store_stocks
    ALTER COLUMN unit SET DEFAULT '개';
