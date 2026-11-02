#!/usr/bin/env bash
# Run by the operator in production. Never sources, copies, or prints environment files.
set -euo pipefail
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  printf '%s\n' 'Usage: bash scripts/migrate-tempori-prod.sh' 'Uses docker compose --env-file .env.prod -f docker-compose.prod.yml exec mysql and the running container MySQL credentials.'
  exit 0
fi
[[ $# == 0 ]] || { printf '%s\n' 'Unexpected arguments; use --help.' >&2; exit 2; }
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd -- "$script_dir/.." && pwd)
command -v docker >/dev/null || { printf '%s\n' 'Docker is required.' >&2; exit 127; }
# Both migrations enter one mysql batch. No SOURCE or --force: first SQL error aborts.
{
  cat "$repo_dir/infra/mysql/migrations/20261101_tempori_cloud_library.sql"
  cat "$repo_dir/infra/mysql/migrations/20261102_tempori_score_states.sql"
} | docker compose --project-directory "$repo_dir" --env-file "$repo_dir/.env.prod" -f "$repo_dir/docker-compose.prod.yml" exec -T mysql sh -eu -c '
  : "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required in the running mysql container}"
  : "${MYSQL_DATABASE:?MYSQL_DATABASE is required in the running mysql container}"
  exec env -i PATH=/usr/bin:/bin MYSQL_TEST_LOGIN_FILE=/dev/null MYSQL_PWD="$MYSQL_ROOT_PASSWORD" \
    mysql --no-defaults --protocol=TCP --host=127.0.0.1 --user=root --database="$MYSQL_DATABASE" --batch --skip-reconnect
'
printf '%s\n' 'Tempori original and state migrations completed; required columns verified.'
