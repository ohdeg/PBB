-- Ŝranko: garment print/logo metadata for dynamic try-on Garment Specs
ALTER TABLE sranko_items
    ADD COLUMN print_meta_json JSON NULL
        COMMENT '{"status":"known|unknown","hasLogo":bool?,"text":string|null}'
        AFTER measurements_json;
