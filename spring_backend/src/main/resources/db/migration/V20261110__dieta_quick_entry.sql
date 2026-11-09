CREATE TABLE IF NOT EXISTS dieta_day_records (
    user_id CHAR(36) NOT NULL,
    logged_on DATE NOT NULL,
    record_key VARCHAR(96) NOT NULL,
    payload JSON NOT NULL,
    PRIMARY KEY (user_id, logged_on, record_key),
    FOREIGN KEY (user_id) REFERENCES dieta_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dieta_favorite_meals (
    user_id CHAR(36) NOT NULL,
    id CHAR(36) NOT NULL,
    name VARCHAR(80) NOT NULL,
    items JSON NOT NULL,
    used_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id) REFERENCES dieta_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
