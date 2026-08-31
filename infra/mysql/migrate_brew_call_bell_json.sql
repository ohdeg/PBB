-- 기존 VARCHAR(200) 멘트 컬럼을 JSON 저장용 TEXT로 늘린다.
ALTER TABLE brew_stores
    MODIFY COLUMN call_bell_phrase TEXT NULL
        COMMENT '호출벨 JSON {phrase,rate,pitch}. 구버전은 멘트 문자열';
