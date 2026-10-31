-- MySQL 8.0.12+ / InnoDB. Select the intended database before running.
-- Run once per deployment operator, in mysql batch mode WITHOUT --force.
-- Existing rows remain LEGACY. Existing LIBRARY/INTAKE rows are never rewritten.
-- Deploy matching backend/frontend together; never mix old and new backends.
-- DDL commits implicitly: this migration does not promise transactional rollback.
-- Reserved helper may remain after an error; a sequential rerun replaces it.

SET @dieta_previous_lock_wait_timeout = @@SESSION.lock_wait_timeout;
SET SESSION lock_wait_timeout = 15;

DROP PROCEDURE IF EXISTS pbb_migrate_dieta_recipe_kind_20261031;
DELIMITER $$
CREATE PROCEDURE pbb_migrate_dieta_recipe_kind_20261031()
SQL SECURITY INVOKER
BEGIN
    DECLARE migration_schema VARCHAR(64);
    DECLARE migration_lock VARCHAR(64);
    DECLARE lock_acquired INT DEFAULT 0;
    DECLARE column_count INT DEFAULT 0;
    DECLARE column_matches INT DEFAULT 0;
    DECLARE migration_result VARCHAR(32) DEFAULT 'ALREADY_APPLIED';
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        IF lock_acquired = 1 THEN
            DO RELEASE_LOCK(migration_lock);
        END IF;
        SET SESSION lock_wait_timeout = @dieta_previous_lock_wait_timeout;
        RESIGNAL;
    END;

    SET migration_schema = DATABASE();
    IF migration_schema IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Select the intended database before running this migration';
    END IF;
    SET migration_lock = CONCAT('pbb:dieta-kind:', LEFT(SHA2(migration_schema, 256), 40));
    SELECT GET_LOCK(migration_lock, 10) INTO lock_acquired;
    IF COALESCE(lock_acquired, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Dieta migration lock unavailable; retry after the other operator finishes';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = migration_schema AND table_name = 'dieta_recipes'
          AND table_type = 'BASE TABLE' AND engine = 'InnoDB'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expected InnoDB dieta_recipes table is missing; check selected database and prerequisite schema';
    END IF;

    SELECT COUNT(*) INTO column_count FROM information_schema.columns
    WHERE table_schema = migration_schema AND table_name = 'dieta_recipes'
      AND column_name = 'record_kind';

    IF column_count = 0 THEN
        -- No automatic fallback to a table-copy operation on unsupported servers/tables.
        ALTER TABLE dieta_recipes
            ADD COLUMN record_kind VARCHAR(16) NOT NULL DEFAULT 'LEGACY',
            ALGORITHM = INSTANT;
        SET migration_result = 'APPLIED';
    END IF;

    SELECT COUNT(*) INTO column_matches FROM information_schema.columns
    WHERE table_schema = migration_schema AND table_name = 'dieta_recipes'
      AND column_name = 'record_kind'
      AND data_type = 'varchar' AND character_maximum_length = 16
      AND is_nullable = 'NO' AND CAST(column_default AS BINARY) = CAST('LEGACY' AS BINARY)
      AND COALESCE(generation_expression, '') = '' AND extra = '';
    IF column_matches <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'record_kind exists with an unexpected definition; no existing column/data was rewritten';
    END IF;

    IF EXISTS (
        SELECT 1 FROM dieta_recipes
        WHERE record_kind IS NULL OR CAST(record_kind AS BINARY) NOT IN (
            CAST('LEGACY' AS BINARY), CAST('LIBRARY' AS BINARY), CAST('INTAKE' AS BINARY)
        )
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unexpected record_kind data found; inspect it manually before deploying';
    END IF;

    SELECT migration_result AS migration_status, migration_schema AS database_name,
           VERSION() AS mysql_version;
    SELECT column_name, column_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = migration_schema AND table_name = 'dieta_recipes'
      AND column_name = 'record_kind';
    SELECT record_kind, COUNT(*) AS row_count FROM dieta_recipes GROUP BY record_kind;
    DO RELEASE_LOCK(migration_lock);
END$$
DELIMITER ;
CALL pbb_migrate_dieta_recipe_kind_20261031();
DROP PROCEDURE pbb_migrate_dieta_recipe_kind_20261031;
SET SESSION lock_wait_timeout = @dieta_previous_lock_wait_timeout;
