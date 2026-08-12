-- Sranko (슈란코) hobby tables. Source of truth also in infra/mysql/init.sql
-- Apply: docker exec -i baseball-mysql mysql -ubaseball_user -pbaseball_password baseball_db < infra/mysql/migrations/20260805_sranko_tables.sql

CREATE TABLE IF NOT EXISTS sranko_prefs (
    user_id                  CHAR(36)       NOT NULL PRIMARY KEY COMMENT 'FK users.id',
    try_on_consent           TINYINT(1)     NOT NULL DEFAULT 0,
    person_image_url         VARCHAR(512)   NULL COMMENT 'R2 public URL',
    sex                      CHAR(1)        NULL COMMENT 'M|F; null treats as M for default mannequin',
    body_measurements_json   JSON           NOT NULL COMMENT 'lengths cm, weight kg, shoeSize mm',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_prefs_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 사용자 설정·인물 사진·신체 사이즈';

CREATE TABLE IF NOT EXISTS sranko_items (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    slot                     VARCHAR(16)    NOT NULL COMMENT 'TOP|BOTTOM|OUTER|SHOES|DRESS|BAG|HAT|JEWELRY',
    category_code            VARCHAR(64)    NOT NULL,
    warmth                   TINYINT        NULL COMMENT 'warmth 1-5; NULL for shoes / unset',
    name                     VARCHAR(120)   NOT NULL,
    image_url                VARCHAR(512)   NOT NULL COMMENT 'R2 public URL',
    measurements_json        JSON           NOT NULL COMMENT '{} or measurement map',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_items_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sranko_items_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 옷장 아이템';

CREATE TABLE IF NOT EXISTS sranko_looks (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    name                     VARCHAR(120)   NOT NULL,
    image_url                VARCHAR(512)   NOT NULL COMMENT 'R2 public URL',
    item_ids_json            JSON           NOT NULL COMMENT 'UUID[] of sranko_items',
    source                   VARCHAR(16)    NOT NULL COMMENT 'COMPOSE|TRY_ON',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_looks_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sranko_looks_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 룩 (입어보기·합성 결과)';

CREATE TABLE IF NOT EXISTS sranko_posts (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    author_user_id           CHAR(36)       NOT NULL,
    subject                  VARCHAR(200)   NOT NULL,
    content                  TEXT           NOT NULL,
    image_url                VARCHAR(512)   NOT NULL COMMENT 'R2 public URL',
    read_count               INT            NOT NULL DEFAULT 0,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_posts_author
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sranko_posts_created (created_at),
    INDEX idx_sranko_posts_reads (read_count),
    INDEX idx_sranko_posts_author (author_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 커뮤니티 게시글';
