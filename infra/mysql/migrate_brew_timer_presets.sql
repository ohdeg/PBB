-- Veveno 타이머 프리셋 (계정 PERSONAL + 가게 STORE)
CREATE TABLE IF NOT EXISTS brew_timer_presets (
    id                   CHAR(36)     NOT NULL PRIMARY KEY COMMENT '프리셋 ID (UUID)',
    scope                VARCHAR(16)  NOT NULL COMMENT 'PERSONAL | STORE',
    user_id              CHAR(36)     NULL COMMENT 'PERSONAL 소유자',
    store_id             CHAR(36)     NULL COMMENT 'STORE 소속 가게',
    created_by_user_id   CHAR(36)     NOT NULL COMMENT '생성자',
    name                 VARCHAR(120) NOT NULL COMMENT '프리셋 이름',
    steps                LONGTEXT     NOT NULL COMMENT 'JSON [{name, durationMs}]',
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_timer_preset_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_timer_preset_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_timer_preset_creator
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_brew_timer_preset_scope
        CHECK (
            (scope = 'PERSONAL' AND user_id IS NOT NULL AND store_id IS NULL)
            OR (scope = 'STORE' AND store_id IS NOT NULL AND user_id IS NULL)
        ),
    INDEX idx_brew_timer_preset_user (user_id),
    INDEX idx_brew_timer_preset_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 타이머 프리셋 (개인/가게 공용)';
