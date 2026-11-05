-- Apply before deploying Tempori cloud support. Rows survive user deletion for object cleanup.
CREATE TABLE IF NOT EXISTS tempori_scores (
 id VARCHAR(36) PRIMARY KEY, owner_id VARCHAR(36) NOT NULL,
 idempotency_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, fingerprint VARCHAR(64) NOT NULL,
 title VARCHAR(200) NOT NULL, artist VARCHAR(200), file_name VARCHAR(255) NOT NULL,
 format VARCHAR(16) NOT NULL, size_bytes BIGINT NOT NULL, sha256 VARCHAR(64) NOT NULL,
 object_key VARCHAR(200) NOT NULL, state VARCHAR(16) NOT NULL,
 created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 lease_until DATETIME(6), cleanup_after DATETIME(6), upload_attempt VARCHAR(36), version BIGINT NOT NULL DEFAULT 0,
 UNIQUE KEY uq_tempori_owner_request (owner_id,idempotency_key),
 KEY ix_tempori_owner_state (owner_id,state,created_at),
 KEY ix_tempori_cleanup (state,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
