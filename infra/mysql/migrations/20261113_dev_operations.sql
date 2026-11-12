CREATE TABLE IF NOT EXISTS ops_daily_error (
    day_kst DATE NOT NULL,
    app VARCHAR(16) NOT NULL,
    operation_key VARCHAR(120) NOT NULL,
    http_status SMALLINT NOT NULL,
    hits BIGINT NOT NULL,
    last_ms BIGINT NOT NULL,
    last_ref CHAR(36) NOT NULL,
    PRIMARY KEY (day_kst, app, operation_key, http_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_admin_change (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    day_kst DATE NOT NULL,
    occurred_ms BIGINT NOT NULL,
    actor_id CHAR(36) NOT NULL,
    action_key VARCHAR(24) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    old_value VARCHAR(255) NOT NULL,
    new_value VARCHAR(255) NOT NULL,
    INDEX ix_ops_admin_day (day_kst, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
