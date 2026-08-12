#!/usr/bin/env bash
# Apply Sranko MySQL migrations using values from .env.prod (or ENV_FILE).
# Usage (from repo root on the server):
#   ./scripts/migrate-sranko-prod.sh
#   ENV_FILE=.env.prod COMPOSE_FILE=docker-compose.prod.yml ./scripts/migrate-sranko-prod.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# strip CR; ignore blank/comment lines
# shellcheck source=/dev/null
source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | sed 's/\r$//')
set +a

if [[ -z "${DB_NAME:-}" ]]; then
  echo "DB_NAME is empty in $ENV_FILE" >&2
  exit 1
fi
if [[ -z "${MYSQL_ROOT_PASSWORD:-}" ]]; then
  echo "MYSQL_ROOT_PASSWORD is empty in $ENV_FILE" >&2
  exit 1
fi

mysql_exec() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mysql \
    mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "$DB_NAME"
}

echo "DB=$DB_NAME  compose=$COMPOSE_FILE  env=$ENV_FILE"
echo "Existing sranko tables:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mysql \
  mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -N -e "SHOW TABLES LIKE 'sranko_%';" "$DB_NAME" \
  || true

FILES=(
  infra/mysql/migrations/20260805_sranko_tables.sql
  infra/mysql/migrations/20260805_sranko_body_measurements.sql
  infra/mysql/migrations/20260805_sranko_item_warmth.sql
  infra/mysql/migrations/20260805_sranko_r2_urls.sql
  infra/mysql/migrations/20260810_sranko_accessory_slots.sql
  infra/mysql/migrations/20260811_sranko_items_print_meta.sql
  infra/mysql/migrations/20260811_sranko_items_drop_print_meta.sql
  infra/mysql/migrations/20260811_sranko_prefs_places.sql
  infra/mysql/migrations/20260811_sranko_prefs_sex.sql
  infra/mysql/migrations/20260812_sranko_post_image_urls.sql
  infra/mysql/migrations/20260812_sranko_post_social.sql
  infra/mysql/migrations/20260812_sranko_prefs_drop_person_image.sql
)

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Skip missing: $f" >&2
    continue
  fi
  echo "=== $f ==="
  # Continue on duplicate column / already-applied errors
  if ! mysql_exec < "$f"; then
    echo "Warning: $f returned non-zero (often already applied). Continuing." >&2
  fi
done

echo "Done. sranko tables now:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mysql \
  mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -N -e "SHOW TABLES LIKE 'sranko_%';" "$DB_NAME"
