-- Sranko community posts: multi-image (Instagram-style carousel).
-- image_url remains the cover (first) URL for compatibility.

ALTER TABLE sranko_posts
    ADD COLUMN image_urls JSON NULL COMMENT 'string[] R2 public URLs (1–10)' AFTER image_url;

UPDATE sranko_posts
SET image_urls = JSON_ARRAY(image_url)
WHERE image_urls IS NULL;

ALTER TABLE sranko_posts
    MODIFY COLUMN image_urls JSON NOT NULL COMMENT 'string[] R2 public URLs (1–10)';
