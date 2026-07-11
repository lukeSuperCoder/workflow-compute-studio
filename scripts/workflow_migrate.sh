#!/usr/bin/env bash
# Mirap Workflow Studio - Database Migration
# Applies migration files in order to the workflow MySQL container.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose-workflow.yml}"
DOCKER_ENV_FILE="${DOCKER_ENV_FILE:-docker/.env.workflow}"
MYSQL_SERVICE="${MYSQL_SERVICE:-workflow-mysql}"
MYSQL_USER="${WORKFLOW_MYSQL_USER:-mirap}"
MYSQL_PASSWORD="${WORKFLOW_MYSQL_PASSWORD:-mirap123}"
MYSQL_DATABASE="${WORKFLOW_MYSQL_DATABASE:-mirap_workflow}"
MIGRATION_DIR="${ROOT_DIR}/migrations"

log() {
  printf '[workflow-migrate] %s\n' "$*"
}

mysql_exec() {
  docker compose -f "$ROOT_DIR/$COMPOSE_FILE" --env-file "$ROOT_DIR/$DOCKER_ENV_FILE" \
    exec -T "$MYSQL_SERVICE" mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" "$@"
}

if ! docker compose -f "$ROOT_DIR/$COMPOSE_FILE" --env-file "$ROOT_DIR/$DOCKER_ENV_FILE" ps -q "$MYSQL_SERVICE" | grep -q .; then
  log "ERROR: MySQL container '$MYSQL_SERVICE' is not running."
  log "Start it first with: make workflow-middleware"
  exit 1
fi

# Track applied migrations in a metadata table.
mysql_exec <<'SQL'
CREATE TABLE IF NOT EXISTS `_mirap_schema_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` bigint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_filename` (`filename`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Mirap migration tracking';
SQL

log "Checking migrations..."

APPLIED=0
SKIPPED=0

for sql_file in "$MIGRATION_DIR"/0[0-9][0-9]_*.sql; do
  [ -f "$sql_file" ] || continue
  filename="$(basename "$sql_file")"

  # Check if already applied
  already=$(mysql_exec -sN -e "SELECT COUNT(*) FROM _mirap_schema_migrations WHERE filename='$(basename "$sql_file")';" 2>/dev/null || echo "0")

  if [ "$already" -gt 0 ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  log "Applying: $filename"
  mysql_exec < "$sql_file"
  mysql_exec -e "INSERT INTO _mirap_schema_migrations (filename, applied_at) VALUES ('$filename', UNIX_TIMESTAMP()*1000);"
  APPLIED=$((APPLIED + 1))
done

TOTAL_TABLES=$(mysql_exec -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$MYSQL_DATABASE' AND table_name NOT LIKE '\_mirap%';" 2>/dev/null || echo "?")

log "Done. Applied=$APPLIED Skipped=$SKIPPED Tables=$TOTAL_TABLES"
