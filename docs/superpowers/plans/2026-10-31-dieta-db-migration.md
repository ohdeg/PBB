# Dieta DB migration execution plan

Scope: apply the approved record_kind expansion to local baseball-mysql and provide the same server-ready SQL plus a password-prompting Docker wrapper. User confirmed local application is pending restoration of Docker access.

- Preserve all rows and nutritional history. Add record_kind VARCHAR(16) NOT NULL DEFAULT 'LEGACY' only when absent; validate an existing column rather than altering it silently.
- Reuse infra/mysql/migrations/20261031_dieta_recipe_kind.sql as the single source. MySQL 8.0.12+ InnoDB, ALGORITHM=INSTANT; fail rather than fall back to a table copy. Bound metadata lock wait.
- Use a migration-specific stored procedure for conditional DDL and SIGNAL, SQL SECURITY INVOKER. It requires CREATE ROUTINE/ALTER ROUTINE/EXECUTE as well as table SELECT/ALTER/CREATE/INSERT. Do not change grants automatically. No transaction rollback claim for DDL. One deployment operator only; the advisory lock does not serialize helper creation/deletion.
- scripts/migrate-dieta-recipe-kind.sh accepts container, database and user explicitly. No .env, compose config, secret arguments, login files, or process-environment credential discovery. Password entry stays inside the user's mysql prompt. Use a unique container temporary SQL file and clean it on both success and failure.
- Review plan before implementation, review resulting SQL/wrapper, run Bash syntax and controlled subprocess tests of the wrapper's success/failure/cleanup paths. Real MySQL checks (first application, rerun, schema mismatch, preserved legacy/current rows) require restored Docker access.
- Actual DB procedure: verify container identity and selected database, inspect schema, apply SQL, verify exact column/default and grouped record kinds. Do not claim application until DB results are observed.
- Local Docker ps failed with permission denied, including require_escalated retry. No chmod, socket bypass, actual environment file access, or database mutation performed.

Implementation: wrapper uses mysql --no-defaults, MYSQL_TEST_LOGIN_FILE=/dev/null, env -i, redirected batch stdin, --skip-reconnect, and a terminal password prompt. Unsupported MySQL 8.0 flags were excluded following independent plan review.

Verification: Bash syntax passed; all 5 fake-Docker wrapper tests passed. Actual MySQL syntax, first run, rerun and data preservation remain unverified until Docker access is restored. Usage and operational constraints are in docs/dieta/DB_MIGRATION.md.

Independent final static review (gpt-6-astra, xhigh): no significant findings in SQL, wrapper, tests or guide. Terminal password prompting against real Docker/MySQL is also pending runtime verification. Final focused wrapper rerun passed 5/5.
