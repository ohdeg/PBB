#!/usr/bin/env bash
# Password is entered directly into mysql's terminal prompt. No environment files are loaded.
set -euo pipefail

usage() {
  printf '%s\n' 'Usage: bash scripts/migrate-dieta-recipe-kind.sh CONTAINER DATABASE USER' \
    'Local: bash scripts/migrate-dieta-recipe-kind.sh baseball-mysql baseball_db baseball_user' \
    'Server: bash scripts/migrate-dieta-recipe-kind.sh pbb-mysql YOUR_DATABASE YOUR_DB_USER'
}
if [[ "${1:-}" == '--help' || "${1:-}" == '-h' ]]; then usage; exit 0; fi
if [[ $# != 3 ]]; then usage >&2; exit 2; fi
container=$1
database=$2
mysql_user=$3
if [[ ! "$container" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ || ! "$database" =~ ^[a-zA-Z0-9_]+$ || ! "$mysql_user" =~ ^[a-zA-Z0-9_]+$ ]]; then
  printf '%s\n' 'Invalid container, database, or user name. Supply plain names, not options or credentials.' >&2
  exit 2
fi
if [[ ! -t 0 || ! -t 1 ]]; then
  printf '%s\n' 'Run from an interactive terminal so mysql can prompt for the password.' >&2
  exit 2
fi
command -v docker >/dev/null || { printf '%s\n' 'docker is not installed.' >&2; exit 127; }
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
sql_file="$script_dir/../infra/mysql/migrations/20261031_dieta_recipe_kind.sql"
[[ -r "$sql_file" ]] || { printf '%s\n' 'Migration SQL not found beside this repository script.' >&2; exit 1; }
remote_sql=''
cleanup() {
  local result=$?
  trap - EXIT
  if [[ -n "$remote_sql" ]]; then
    if ! docker exec "$container" rm -f -- "$remote_sql"; then
      printf 'Temporary SQL cleanup failed in %s: %s\n' "$container" "$remote_sql" >&2
      if [[ $result == 0 ]]; then result=1; fi
    fi
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
remote_sql=$(docker exec "$container" mktemp /tmp/pbb-dieta-record-kind.XXXXXXXX)
if [[ ! "$remote_sql" =~ ^/tmp/pbb-dieta-record-kind\.[a-zA-Z0-9]+$ ]]; then
  remote_sql=''
  printf '%s\n' 'Unexpected temporary path returned by the container; aborting.' >&2
  exit 1
fi
docker cp "$sql_file" "$container:$remote_sql"
printf 'Applying Dieta migration: container=%s database=%s user=%s\n' "$container" "$database" "$mysql_user"
# Clean child environment + --no-defaults avoids implicit credential/config discovery.
# MySQL 8.0 still reads login files with --no-defaults; redirect that path to /dev/null.
# Redirect SQL inside the container: mysql uses /dev/tty for the password, stdin for SQL.
# Batch mode aborts on the first SQL error. Do not add --force or use the source command.
docker exec -it "$container" env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin MYSQL_TEST_LOGIN_FILE=/dev/null \
  sh -c 'exec mysql --no-defaults --protocol=TCP --host=127.0.0.1 --port=3306 --user="$1" --database="$2" --password --batch --skip-reconnect < "$3"' \
  sh "$mysql_user" "$database" "$remote_sql"
printf '%s\n' 'Dieta migration and schema verification succeeded.'
