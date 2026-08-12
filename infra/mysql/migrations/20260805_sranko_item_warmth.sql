-- Sranko items: warmth score (1–5) for taxonomy / future training ground truth
-- Apply: docker exec -i baseball-mysql mysql -ubaseball_user -pbaseball_password baseball_db < infra/mysql/migrations/20260805_sranko_item_warmth.sql

ALTER TABLE sranko_items
    ADD COLUMN warmth TINYINT NULL
        COMMENT 'warmth 1-5; NULL for shoes / unset'
        AFTER category_code;

ALTER TABLE sranko_items
    MODIFY COLUMN slot VARCHAR(16) NOT NULL
        COMMENT 'TOP|BOTTOM|OUTER|SHOES|DRESS';
