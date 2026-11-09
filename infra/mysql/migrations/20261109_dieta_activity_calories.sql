SET @dieta_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'dieta_activity_logs' AND column_name = 'split_calories'),
    'SELECT 1', 'ALTER TABLE dieta_activity_logs ADD COLUMN split_calories BOOLEAN NOT NULL DEFAULT FALSE');
PREPARE dieta_stmt FROM @dieta_ddl;
EXECUTE dieta_stmt;
DEALLOCATE PREPARE dieta_stmt;

SET @dieta_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'dieta_activity_logs' AND column_name = 'walking_kcal'),
    'SELECT 1', 'ALTER TABLE dieta_activity_logs ADD COLUMN walking_kcal INT NULL');
PREPARE dieta_stmt FROM @dieta_ddl;
EXECUTE dieta_stmt;
DEALLOCATE PREPARE dieta_stmt;

SET @dieta_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'dieta_activity_logs' AND column_name = 'exercise_kcal'),
    'SELECT 1', 'ALTER TABLE dieta_activity_logs ADD COLUMN exercise_kcal INT NULL');
PREPARE dieta_stmt FROM @dieta_ddl;
EXECUTE dieta_stmt;
DEALLOCATE PREPARE dieta_stmt;
