-- Sranko: switch image columns from MEDIUMTEXT data URLs to VARCHAR public URLs (R2).
-- Clears prototype data-URL rows first (too large / incompatible with VARCHAR(512)).

DELETE FROM sranko_posts;
DELETE FROM sranko_looks;
DELETE FROM sranko_items;
UPDATE sranko_prefs SET person_image_data_url = NULL, try_on_consent = 0;

ALTER TABLE sranko_prefs
    CHANGE COLUMN person_image_data_url person_image_url VARCHAR(512) NULL
        COMMENT 'R2 public URL';

ALTER TABLE sranko_items
    CHANGE COLUMN image_data_url image_url VARCHAR(512) NOT NULL
        COMMENT 'R2 public URL';

ALTER TABLE sranko_looks
    CHANGE COLUMN image_data_url image_url VARCHAR(512) NOT NULL
        COMMENT 'R2 public URL';

ALTER TABLE sranko_posts
    CHANGE COLUMN image_data_url image_url VARCHAR(512) NOT NULL
        COMMENT 'R2 public URL';
