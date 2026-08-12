-- Sranko items: optional brand + product URL for lookbook display.

ALTER TABLE sranko_items
    ADD COLUMN brand VARCHAR(80) NULL COMMENT '브랜드 (선택)' AFTER name,
    ADD COLUMN product_url VARCHAR(512) NULL COMMENT '상품 URL http(s) (선택)' AFTER brand;
