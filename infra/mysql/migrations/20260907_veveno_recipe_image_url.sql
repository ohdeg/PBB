ALTER TABLE brew_recipes
    ADD COLUMN image_url VARCHAR(512) NULL COMMENT 'R2 public URL' AFTER contents;
