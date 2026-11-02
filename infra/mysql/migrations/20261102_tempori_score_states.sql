-- Apply after 20261101_tempori_cloud_library.sql. Original rows remain as cleanup tombstones.
CREATE TABLE IF NOT EXISTS tempori_score_states (
 id VARCHAR(36) PRIMARY KEY,
 score_id VARCHAR(36) NOT NULL, owner_id VARCHAR(36) NOT NULL,
 document_key VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 schema_version INT NOT NULL, revision BIGINT NOT NULL,
 payload JSON NOT NULL, payload_bytes BIGINT NOT NULL, updated_at DATETIME(6) NOT NULL,
 UNIQUE KEY uq_tempori_state_document (score_id, document_key),
 CONSTRAINT fk_tempori_state_score FOREIGN KEY (score_id) REFERENCES tempori_scores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS tempori_state_mutations (
 id VARCHAR(36) PRIMARY KEY, score_id VARCHAR(36) NOT NULL,
 mutation_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT NOT NULL, updated_at DATETIME(6) NOT NULL,
 UNIQUE KEY uq_tempori_state_mutation (score_id, mutation_id),
 KEY ix_tempori_mutation_recent (score_id, updated_at, id),
 CONSTRAINT fk_tempori_mutation_score FOREIGN KEY (score_id) REFERENCES tempori_scores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Column references deliberately fail the batch if an incompatible pre-existing table exists.
SELECT id, score_id, owner_id, document_key, schema_version, revision, payload, payload_bytes, updated_at FROM tempori_score_states LIMIT 0;
SELECT id, score_id, mutation_id, request_hash, revision, updated_at FROM tempori_state_mutations LIMIT 0;
