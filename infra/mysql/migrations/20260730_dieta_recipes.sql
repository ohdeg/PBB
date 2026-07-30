-- Dieta recipes table (idempotent). Source: infra/mysql/init.sql
-- Apply: docker exec -i baseball-mysql mysql -ubaseball_user -pbaseball_password baseball_db < infra/mysql/migrations/20260730_dieta_recipes.sql

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
