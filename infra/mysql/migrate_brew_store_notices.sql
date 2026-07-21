-- Veveno 가게 공지
CREATE TABLE IF NOT EXISTS brew_store_notices (
    id                CHAR(36)      NOT NULL PRIMARY KEY COMMENT '공지 ID (UUID)',
    store_id          CHAR(36)      NOT NULL COMMENT '가게 ID',
    author_user_id    CHAR(36)      NOT NULL COMMENT '작성자 (owner)',
    title             VARCHAR(200)  NOT NULL COMMENT '제목',
    body              TEXT          NOT NULL COMMENT '본문',
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_notice_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_notice_author
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_brew_notice_store_created (store_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 가게 공지';
