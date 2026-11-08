-- Apply before deploying the backend. Existing users opt in explicitly.
CREATE TABLE IF NOT EXISTS dieta_meal_schedules (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    local_time CHAR(5) NOT NULL,
    zone_id VARCHAR(100) NOT NULL,
    next_run_ms BIGINT NOT NULL,
    INDEX ix_dieta_due (next_run_ms, user_id),
    FOREIGN KEY (user_id) REFERENCES dieta_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dieta_meal_analysis_days (
    user_id CHAR(36) NOT NULL,
    logged_on DATE NOT NULL,
    stage VARCHAR(10) NOT NULL,
    origin VARCHAR(12) NOT NULL,
    state VARCHAR(12) NOT NULL,
    claim_id CHAR(36) NOT NULL,
    PRIMARY KEY (user_id, logged_on, stage),
    FOREIGN KEY (user_id) REFERENCES dieta_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
