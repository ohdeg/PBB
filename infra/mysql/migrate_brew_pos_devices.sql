-- Veveno POS 등록 기기 (가게당 최대 3대는 애플리케이션에서 COUNT)
CREATE TABLE IF NOT EXISTS brew_pos_devices (
    id                  CHAR(36)     NOT NULL PRIMARY KEY COMMENT '행 ID (UUID)',
    store_id            CHAR(36)     NOT NULL COMMENT '소속 가게',
    device_id           VARCHAR(64)  NOT NULL COMMENT 'POS 브라우저 기기 ID',
    enrolled_by_user_id CHAR(36)     NOT NULL COMMENT '최초 등록한 업주',
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_pos_device_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    -- CASCADE: 회원 탈퇴 시 가게 CASCADE와 맞춘다. RESTRICT면 탈퇴가 막힌다.
    CONSTRAINT fk_brew_pos_device_enrolled
        FOREIGN KEY (enrolled_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_brew_pos_store_device (store_id, device_id),
    INDEX idx_brew_pos_store (store_id),
    INDEX idx_brew_pos_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno POS 등록 기기 화이트리스트';
