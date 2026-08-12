-- Sranko prefs: biological sex for default mannequin (M|F). Null → male fallback.
-- Apply: docker exec -i baseball-mysql mysql -ubaseball_user -pbaseball_password baseball_db < infra/mysql/migrations/20260811_sranko_prefs_sex.sql

ALTER TABLE sranko_prefs
    ADD COLUMN sex CHAR(1) NULL COMMENT 'M|F; null treats as M for default mannequin'
        AFTER person_image_url;
