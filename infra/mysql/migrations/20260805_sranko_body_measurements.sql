-- Sranko prefs: body measurements (stored as cm / kg / mm strings in JSON)
-- Apply: docker exec -i baseball-mysql mysql -ubaseball_user -pbaseball_password baseball_db < infra/mysql/migrations/20260805_sranko_body_measurements.sql

ALTER TABLE sranko_prefs
    ADD COLUMN body_measurements_json JSON NOT NULL DEFAULT (JSON_OBJECT())
        COMMENT 'body size map; lengths cm, weight kg, shoeSize mm'
        AFTER person_image_url;
