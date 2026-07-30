-- Dieta schema (Phase 1–2 entities under domain/dieta)
-- 적용 (기존 볼륨·데이터 유지):
--   docker exec -i baseball-mysql mysql -uroot -proot_password baseball_db < infra/mysql/migrate_dieta.sql
-- 신규 DB는 init.sql만으로도 동일 테이블이 생성됩니다.
-- 스키마가 너무 오래됐을 때: docker compose down -v && docker compose up -d  (데이터 삭제)

CREATE TABLE IF NOT EXISTS dieta_profiles (
    user_id                  CHAR(36)       NOT NULL PRIMARY KEY COMMENT 'FK users.id',
    height_cm                DECIMAL(5,1)   NOT NULL,
    goal_type                VARCHAR(16)    NOT NULL COMMENT 'LOSS|GAIN|MAINTAIN',
    last_non_maintain_goal_type VARCHAR(16) NOT NULL DEFAULT 'LOSS' COMMENT 'LOSS|GAIN remembered for maintain toggle OFF',
    weekly_target_kg         DECIMAL(4,2)   NOT NULL DEFAULT 0,
    target_weight_kg         DECIMAL(5,2)   NULL COMMENT 'goal body weight; switch to MAINTAIN on reach',
    weekly_effective_kg      DECIMAL(4,2)   NULL COMMENT 'W×0.9 internal (legacy/alias)',
    weekly_body_fat_loss_kg  DECIMAL(4,2)   NULL COMMENT 'LOSS derived W×0.9',
    weekly_muscle_gain_kg    DECIMAL(4,2)   NULL COMMENT 'GAIN derived W×0.9',
    intensity_preference     VARCHAR(16)    NULL COMMENT 'BOOST|HOLD',
    bmr_kcal                 INT            NOT NULL,
    bmr_source               VARCHAR(16)    NOT NULL COMMENT 'USER_ENTERED|ESTIMATED',
    activity_factor          DECIMAL(4,2)   NOT NULL,
    tdee_kcal                INT            NOT NULL,
    daily_kcal               INT            NOT NULL,
    diet_style               VARCHAR(16)    NOT NULL,
    macros_json              JSON           NOT NULL COMMENT '{carbPct,proteinPct,fatPct}',
    macros_customized        TINYINT(1)     NOT NULL DEFAULT 0,
    diet_baseline_method     VARCHAR(16)    NULL COMMENT 'SURVEY|DIARY_5D',
    loss_initial_deficit_kcal INT           NOT NULL DEFAULT 400,
    gain_initial_surplus_kcal INT           NOT NULL DEFAULT 250,
    loss_cut_kcal            INT            NOT NULL DEFAULT 175,
    loss_recover_kcal        INT            NOT NULL DEFAULT 150,
    loss_activity_kcal       INT            NOT NULL DEFAULT 150,
    gain_surplus_kcal        INT            NOT NULL DEFAULT 250,
    gain_cut_kcal            INT            NOT NULL DEFAULT 175,
    gain_ceiling_delta_kcal  INT            NOT NULL DEFAULT 500,
    gemini_meal_consent      TINYINT(1)     NOT NULL DEFAULT 0,
    week_starts_on           DATE           NOT NULL,
    week_activity_extra_kcal INT            NOT NULL DEFAULT 0,
    onboarding_complete      TINYINT(1)     NOT NULL DEFAULT 0,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 프로필·주간 코칭 설정';

-- Phase 1 profile columns (idempotent) — if an older dieta_profiles exists without these
SET @db := DATABASE();

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'last_non_maintain_goal_type') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN last_non_maintain_goal_type VARCHAR(16) NOT NULL DEFAULT ''LOSS'' COMMENT ''LOSS|GAIN remembered for maintain toggle OFF'' AFTER goal_type',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'target_weight_kg') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN target_weight_kg DECIMAL(5,2) NULL COMMENT ''goal body weight; switch to MAINTAIN on reach'' AFTER weekly_target_kg',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'weekly_effective_kg') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN weekly_effective_kg DECIMAL(4,2) NULL COMMENT ''W×0.9 internal (legacy/alias)'' AFTER target_weight_kg',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'weekly_body_fat_loss_kg') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN weekly_body_fat_loss_kg DECIMAL(4,2) NULL COMMENT ''LOSS derived W×0.9'' AFTER weekly_effective_kg',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'weekly_muscle_gain_kg') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN weekly_muscle_gain_kg DECIMAL(4,2) NULL COMMENT ''GAIN derived W×0.9'' AFTER weekly_body_fat_loss_kg',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'intensity_preference') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN intensity_preference VARCHAR(16) NULL COMMENT ''BOOST|HOLD'' AFTER weekly_muscle_gain_kg',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'diet_baseline_method') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN diet_baseline_method VARCHAR(16) NULL COMMENT ''SURVEY|DIARY_5D'' AFTER macros_customized',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'loss_initial_deficit_kcal') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN loss_initial_deficit_kcal INT NOT NULL DEFAULT 400 AFTER diet_baseline_method',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'gain_initial_surplus_kcal') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN gain_initial_surplus_kcal INT NOT NULL DEFAULT 250 AFTER loss_initial_deficit_kcal',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'loss_cut_kcal') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN loss_cut_kcal INT NOT NULL DEFAULT 175 AFTER gain_initial_surplus_kcal',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'loss_recover_kcal') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN loss_recover_kcal INT NOT NULL DEFAULT 150 AFTER loss_cut_kcal',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'loss_activity_kcal') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN loss_activity_kcal INT NOT NULL DEFAULT 150 AFTER loss_recover_kcal',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'gain_surplus_kcal') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN gain_surplus_kcal INT NOT NULL DEFAULT 250 AFTER loss_activity_kcal',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'gain_cut_kcal') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN gain_cut_kcal INT NOT NULL DEFAULT 175 AFTER gain_surplus_kcal',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'gain_ceiling_delta_kcal') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN gain_ceiling_delta_kcal INT NOT NULL DEFAULT 500 AFTER gain_cut_kcal',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'gemini_meal_consent') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN gemini_meal_consent TINYINT(1) NOT NULL DEFAULT 0 AFTER gain_ceiling_delta_kcal',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dieta_profiles' AND COLUMN_NAME = 'week_activity_extra_kcal') = 0,
        'ALTER TABLE dieta_profiles ADD COLUMN week_activity_extra_kcal INT NOT NULL DEFAULT 0 AFTER week_starts_on',
        'SELECT 1'
    )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS dieta_body_logs (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL,
    weight_kg                DECIMAL(5,2)   NULL,
    body_fat_mass_kg         DECIMAL(5,2)   NULL COMMENT 'unused in MVP (weight-only)',
    skeletal_muscle_mass_kg  DECIMAL(5,2)   NULL COMMENT 'unused in MVP (weight-only)',
    fasted                   TINYINT(1)     NOT NULL DEFAULT 1,
    source                   VARCHAR(16)    NOT NULL COMMENT 'DAILY_FASTED|ONBOARDING|CHECK_IN|MANUAL',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_body_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_dieta_body_user_day (user_id, logged_on),
    INDEX idx_dieta_body_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 체중 로그 (체지방/골격근 컬럼은 예약, MVP 미사용)';

CREATE TABLE IF NOT EXISTS dieta_intake_logs (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL,
    carb_g                   DECIMAL(7,1)   NOT NULL DEFAULT 0,
    protein_g                DECIMAL(7,1)   NOT NULL DEFAULT 0,
    fat_g                    DECIMAL(7,1)   NOT NULL DEFAULT 0,
    kcal                     INT            NOT NULL COMMENT 'from Gemini totals or macros formula',
    review                   TEXT           NULL COMMENT 'Gemini one-line diet review',
    source_meals_json        JSON           NULL COMMENT 'queue meals + queueTotals + recipeIds[] + knownRecipes audit',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_intake_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_dieta_intake_user_day (user_id, logged_on),
    INDEX idx_dieta_intake_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 일별 섭취(마감 Gemini 결과). 낮 큐는 Redis';

CREATE TABLE IF NOT EXISTS dieta_recipes (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL COMMENT 'day-scoped; no bookshelf yet',
    meal_type                VARCHAR(16)    NULL COMMENT 'BREAKFAST|LUNCH|DINNER|SNACK; null on create until add-to-day',
    title                    VARCHAR(200)   NOT NULL,
    ingredients_json         JSON           NOT NULL COMMENT 'string[] ingredient lines',
    steps                    TEXT           NULL,
    carb_g                   DECIMAL(7,1)   NOT NULL DEFAULT 0 COMMENT 'per 1 serving',
    protein_g                DECIMAL(7,1)   NOT NULL DEFAULT 0 COMMENT 'per 1 serving',
    fat_g                    DECIMAL(7,1)   NOT NULL DEFAULT 0 COMMENT 'per 1 serving',
    kcal                     INT            NOT NULL COMMENT 'per 1 serving',
    one_line_review          TEXT           NULL,
    servings                 DECIMAL(6,2)   NOT NULL DEFAULT 1.00 COMMENT 'batch servings at create; macros are per 1 serving',
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_recipes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_dieta_recipes_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 당일 레시피 분석 결과 (logged_on 스코프; macros per serving)';

CREATE TABLE IF NOT EXISTS dieta_activity_logs (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL,
    steps                    INT            NULL,
    duration_min             INT            NULL,
    activity_kcal            INT            NULL,
    note                     VARCHAR(255)   NULL,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_activity_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_dieta_activity_user_day (user_id, logged_on),
    INDEX idx_dieta_activity_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 일별 활동량';

CREATE TABLE IF NOT EXISTS dieta_keto_events (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    recorded_at              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ease_requested           TINYINT(1)     NOT NULL DEFAULT 0,

    CONSTRAINT fk_dieta_keto_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_dieta_keto_user_time (user_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 키토플루 이벤트';

CREATE TABLE IF NOT EXISTS dieta_check_in_logs (
    id                       CHAR(36)       NOT NULL PRIMARY KEY,
    user_id                  CHAR(36)       NOT NULL,
    logged_on                DATE           NOT NULL,
    weight_kg                DECIMAL(5,2)   NULL,
    baseline_weight_kg       DECIMAL(5,2)   NULL,
    weight_delta_kg          DECIMAL(5,2)   NULL,
    keep_targets             TINYINT(1)     NOT NULL DEFAULT 0 COMMENT 'true=keep daily/W/activity; ignore weight X',
    applied_daily_kcal       INT            NOT NULL,
    applied_activity_extra_kcal INT         NOT NULL DEFAULT 0,
    applied_weekly_target_kg DECIMAL(4,2)   NOT NULL DEFAULT 0,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_dieta_check_in_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_dieta_check_in_user_day (user_id, logged_on),
    INDEX idx_dieta_check_in_user_day (user_id, logged_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dieta 주간 체크인 확정 로그 (apply API Phase 2+)';
