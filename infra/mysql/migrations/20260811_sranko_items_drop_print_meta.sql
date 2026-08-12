-- Ŝranko: drop unused garment print/logo cache (analysis removed from try-on pipeline)
ALTER TABLE sranko_items
    DROP COLUMN print_meta_json;
