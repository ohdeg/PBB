SET NAMES utf8mb4;

ALTER TABLE brew_store_stocks
    ADD COLUMN unit VARCHAR(16) NOT NULL DEFAULT '개'
        COMMENT '표시 단위'
        AFTER stock_min_num,
    ADD COLUMN order_url VARCHAR(512) NULL
        COMMENT '발주 링크 http/https'
        AFTER unit;

CREATE TABLE IF NOT EXISTS brew_store_stock_logs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    stock_id INT NOT NULL,
    user_id CHAR(36) NOT NULL,
    from_num INT NOT NULL,
    to_num INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_stock_log_stock
        FOREIGN KEY (stock_id) REFERENCES brew_store_stocks(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_stock_log_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_brew_stock_logs_stock (stock_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 재고 수량 변경 이력';
