ALTER TABLE brew_stores
    ADD COLUMN stock_usage_hint TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1이면 사용량 일수 안내'
        AFTER stock_edit_off_duty;

CREATE TABLE IF NOT EXISTS brew_store_stock_usage_days (
    stock_id INT NOT NULL,
    used_on DATE NOT NULL,
    qty INT NOT NULL DEFAULT 0,
    PRIMARY KEY (stock_id, used_on),
    CONSTRAINT fk_brew_usage_stock
        FOREIGN KEY (stock_id) REFERENCES brew_store_stocks(id) ON DELETE CASCADE,
    CONSTRAINT chk_brew_usage_qty CHECK (qty >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 재고 일별 사용량 (감소분 누적, +1 상쇄)';
