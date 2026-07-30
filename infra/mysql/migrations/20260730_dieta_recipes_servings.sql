-- Dieta recipes: nullable meal_type + servings (per-serving macros)
-- Apply: docker exec -i baseball-mysql mysql -ubaseball_user -pbaseball_password baseball_db < infra/mysql/migrations/20260730_dieta_recipes_servings.sql

ALTER TABLE dieta_recipes
    MODIFY COLUMN meal_type VARCHAR(16) NULL
        COMMENT 'BREAKFAST|LUNCH|DINNER|SNACK; null on create/library source until add-to-day sets day copy',
    ADD COLUMN servings DECIMAL(6, 2) NOT NULL DEFAULT 1.00
        COMMENT 'batch servings entered at create; carb/protein/fat/kcal are per 1 serving'
        AFTER one_line_review;
