ALTER TABLE brew_stores
    ADD COLUMN call_bell_phrase TEXT NULL
        COMMENT '호출벨 JSON {phrase,rate,pitch}. 구버전은 멘트 문자열'
        AFTER stock_usage_hint;
