-- Staff stock edits off-duty: store setting (0=근무 중에만, default)
ALTER TABLE brew_stores
    ADD COLUMN stock_edit_off_duty TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1이면 재고권한 직원이 근무 외에도 재고 수정'
        AFTER invite_code;
