ALTER TABLE brew_menus
    ADD COLUMN image_url VARCHAR(512) NULL COMMENT 'R2 public URL' AFTER name;

ALTER TABLE brew_store_stocks
    ADD COLUMN image_url VARCHAR(512) NULL COMMENT 'R2 public URL' AFTER order_url;
