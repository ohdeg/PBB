-- Sranko community: likes, comments (2-level), comment likes, denormalized counts.
-- View dedupe is Redis-only (no table).

ALTER TABLE sranko_posts
    ADD COLUMN like_count INT NOT NULL DEFAULT 0 AFTER read_count,
    ADD COLUMN comment_count INT NOT NULL DEFAULT 0 AFTER like_count;

CREATE TABLE IF NOT EXISTS sranko_post_likes (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    post_id                  CHAR(36)       NOT NULL,
    user_id                  CHAR(36)       NOT NULL,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_post_likes_post
        FOREIGN KEY (post_id) REFERENCES sranko_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_sranko_post_likes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sranko_post_likes_post_user (post_id, user_id),
    INDEX idx_sranko_post_likes_user_post (user_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 게시글 좋아요';

CREATE TABLE IF NOT EXISTS sranko_post_comments (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    post_id                  CHAR(36)       NOT NULL,
    author_user_id           CHAR(36)       NOT NULL,
    parent_id                CHAR(36)       NULL COMMENT 'NULL=root; non-null must point to root comment',
    body                     VARCHAR(500)   NOT NULL,
    like_count               INT            NOT NULL DEFAULT 0,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_post_comments_post
        FOREIGN KEY (post_id) REFERENCES sranko_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_sranko_post_comments_author
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sranko_post_comments_parent
        FOREIGN KEY (parent_id) REFERENCES sranko_post_comments(id) ON DELETE CASCADE,
    INDEX idx_sranko_post_comments_post_created (post_id, created_at),
    INDEX idx_sranko_post_comments_parent (post_id, parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 게시 댓글·대댓글(2단)';

CREATE TABLE IF NOT EXISTS sranko_post_comment_likes (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    comment_id               CHAR(36)       NOT NULL,
    user_id                  CHAR(36)       NOT NULL,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sranko_post_comment_likes_comment
        FOREIGN KEY (comment_id) REFERENCES sranko_post_comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_sranko_post_comment_likes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sranko_comment_likes_comment_user (comment_id, user_id),
    INDEX idx_sranko_comment_likes_user_comment (user_id, comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='슈란코 댓글 좋아요';
