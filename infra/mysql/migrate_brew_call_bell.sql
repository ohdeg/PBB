ALTER TABLE brew_stores
    ADD COLUMN call_bell_phrase VARCHAR(200) NULL
        COMMENT '호출벨 멘트'
        AFTER stock_usage_hint;
