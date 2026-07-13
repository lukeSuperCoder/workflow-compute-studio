#!/usr/bin/env bash
#
# Copyright 2025 coze-dev Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Mirap Workflow Studio - controlled data cutover from coze-studio-debug.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CUTOVER_ROOT="${WORKFLOW_CUTOVER_ROOT:-$ROOT_DIR/backups/workflow-cutover}"
SOURCE_MYSQL_CONTAINER="${SOURCE_MYSQL_CONTAINER:-coze-mysql}"
SOURCE_MINIO_CONTAINER="${SOURCE_MINIO_CONTAINER:-coze-minio}"
SOURCE_DATABASE="${SOURCE_DATABASE:-opencoze}"
TARGET_MYSQL_CONTAINER="${TARGET_MYSQL_CONTAINER:-mirap-workflow-mysql}"
TARGET_ENV_FILE="${TARGET_ENV_FILE:-$ROOT_DIR/docker/.env.workflow}"
TARGET_STORAGE_ROOT="${TARGET_STORAGE_ROOT:-$ROOT_DIR/storage}"
MIGRATION_TABLES="user space space_user workflow_meta workflow_draft workflow_version workflow_reference"
CLEAR_TABLES="workflow_reference workflow_version workflow_draft workflow_meta space_user space user node_execution workflow_snapshot workflow_execution files"

log() {
  printf '[workflow-cutover] %s\n' "$*"
}

die() {
  log "ERROR: $*" >&2
  return 1
}

normalize_object_key() {
  local key="${1:-}"
  case "$key" in
    ''|/*|*'..'*|*'//'*) return 1 ;;
  esac
  printf '%s\n' "$key"
}

normalize_run_id() {
  local run_id="${1:-}"
  case "$run_id" in
    ''|.|..|*..*|*[!A-Za-z0-9._-]*) die "invalid run ID: $run_id"; return 1 ;;
  esac
  printf '%s\n' "$run_id"
}

csv_join() {
  local out='' value
  for value in "$@"; do
    if [ -n "$out" ]; then
      out="$out,$value"
    else
      out="$value"
    fi
  done
  printf '%s\n' "$out"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

require_container_running() {
  local state
  state="$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)"
  [ "$state" = true ] || die "container is not running: $1"
}

require_destructive_confirmation() {
  local action="${1:-}" run_id="${2:-}" confirmed="${3:-false}"
  [ -n "$run_id" ] || { die "$action requires --run-id"; return 1; }
  [ "$confirmed" = true ] || { die "$action requires --confirm"; return 1; }
}

create_run_dir() {
  local run_id run_dir
  run_id="$(normalize_run_id "$1")"
  run_dir="$CUTOVER_ROOT/$run_id"
  mkdir -p "$run_dir"
  chmod 700 "$run_dir"
  printf '%s\n' "$run_dir"
}

write_manifest_value() {
  local manifest="$1" key="$2" value="$3"
  case "$key" in
    *password*|*PASSWORD*|*secret*|*SECRET*) die "refusing to persist secret manifest key: $key" ;;
  esac
  printf '%s=%s\n' "$key" "$value" >> "$manifest"
}

load_target_env() {
  [ -f "$TARGET_ENV_FILE" ] || die "target env file not found: $TARGET_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$TARGET_ENV_FILE"
  set +a
  TARGET_DATABASE="${WORKFLOW_MYSQL_DATABASE:-mirap_workflow}"
  [ "$TARGET_DATABASE" = mirap_workflow ] || die "unexpected target database: $TARGET_DATABASE"
  [ "$SOURCE_DATABASE" != "$TARGET_DATABASE" ] || die 'source and target databases must differ'
}

source_mysql() {
  docker exec "$SOURCE_MYSQL_CONTAINER" sh -lc \
    'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N "$@"' sh "$@"
}

target_mysql() {
  docker exec "$TARGET_MYSQL_CONTAINER" sh -lc \
    'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N "$@"' sh "$@"
}

source_dump() {
  docker exec "$SOURCE_MYSQL_CONTAINER" sh -lc \
    'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --skip-triggers --no-create-info --complete-insert --set-gtid-purged=OFF "$@"' sh "$@"
}

source_dump_where() {
  local database="$1" table="$2" where="$3"
  docker exec "$SOURCE_MYSQL_CONTAINER" sh -lc \
    'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --skip-triggers --no-create-info --complete-insert --set-gtid-purged=OFF --where="$3" "$1" "$2"' \
    sh "$database" "$table" "$where"
}

target_dump() {
  docker exec "$TARGET_MYSQL_CONTAINER" sh -lc \
    'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --skip-triggers --no-create-info --complete-insert --set-gtid-purged=OFF "$@"' sh "$@"
}

manifest_value() {
  local manifest="$1" key="$2"
  awk -F= -v wanted="$key" '$1 == wanted { value=substr($0, index($0,"=")+1) } END { print value }' "$manifest"
}

workflow_source_where() {
  local table="${1:-}" workflow_ids="${2:-}"
  case "$workflow_ids" in
    ''|*[!0-9,]*|,*|*,|*,,*) die "invalid workflow ID list: $workflow_ids"; return 1 ;;
  esac
  case "$table" in
    workflow_meta|workflow_draft) printf 'id IN (%s)\n' "$workflow_ids" ;;
    workflow_version) printf 'workflow_id IN (%s)\n' "$workflow_ids" ;;
    workflow_reference) printf 'referring_id IN (%s) AND referred_id IN (%s)\n' "$workflow_ids" "$workflow_ids" ;;
    *) die "workflow filtering is unsupported for table: $table"; return 1 ;;
  esac
}

eligible_workflow_ids() {
  source_mysql "$SOURCE_DATABASE" -e "
    SELECT GROUP_CONCAT(DISTINCT m.id ORDER BY m.id SEPARATOR ',')
    FROM workflow_meta m
    JOIN space s ON s.id=m.space_id
    JOIN user u ON u.id=m.creator_id
    JOIN space_user su ON su.space_id=m.space_id AND su.user_id=m.creator_id;"
}

excluded_workflow_ids() {
  source_mysql "$SOURCE_DATABASE" -e "
    SELECT GROUP_CONCAT(m.id ORDER BY m.id SEPARATOR ',')
    FROM workflow_meta m
    WHERE NOT EXISTS (SELECT 1 FROM space s WHERE s.id=m.space_id)
       OR NOT EXISTS (SELECT 1 FROM user u WHERE u.id=m.creator_id)
       OR NOT EXISTS (
         SELECT 1 FROM space_user su
         WHERE su.space_id=m.space_id AND su.user_id=m.creator_id
       );"
}

source_migration_count() {
  local table="$1" workflow_ids="$2" where
  case "$table" in
    workflow_meta|workflow_draft|workflow_version|workflow_reference)
      where="$(workflow_source_where "$table" "$workflow_ids")"
      source_mysql "$SOURCE_DATABASE" -e "SELECT COUNT(*) FROM \`$table\` WHERE $where;"
      ;;
    *) table_count source "$table" ;;
  esac
}

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

source_minio_cat() {
  local key="$1"
  normalize_object_key "$key" >/dev/null || die "unsafe MinIO object key: $key"
  docker exec "$SOURCE_MINIO_CONTAINER" sh -lc '
    export MC_CONFIG_DIR=/tmp/mc-workflow-cutover
    mc alias set source http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    exec mc cat "source/opencoze/$1"
  ' sh "$key"
}

build_source_file_manifest() {
  local run_dir="$1" dump="$run_dir/source-selected.sql" list="$run_dir/source-minio-files.tsv" key tmp refs target
  : > "$list"
  : > "$run_dir/source-missing-seeded-files.tsv"
  tmp="$run_dir/.source-object"
  refs="$run_dir/.referenced-object-keys"
  rg -o 'default_icon/[A-Za-z0-9._/-]+|tos-cn-i-[A-Za-z0-9._/-]+' "$dump" | sort -u > "$refs"
  while IFS= read -r key; do
    normalize_object_key "$key" >/dev/null || die "unsafe referenced object key: $key"
    if source_minio_cat "$key" > "$tmp" 2>/dev/null; then
      printf '%s\t%s\t%s\n' "$key" "$(wc -c < "$tmp" | tr -d ' ')" "$(sha256_file "$tmp")" >> "$list"
      continue
    fi
    target="$TARGET_STORAGE_ROOT/$key"
    case "$key" in
      default_icon/workflow_icon/icon-subworkflow.jpg)
        local fallback="$TARGET_STORAGE_ROOT/default_icon/workflow_icon/icon-workflow.jpg"
        [ -f "$fallback" ] || die "subworkflow fallback icon is missing: $fallback"
        mkdir -p "$(dirname "$target")"
        cp "$fallback" "$target"
        printf '%s\tseeded-substitution:default_icon/workflow_icon/icon-workflow.jpg\n' "$key" >> "$run_dir/source-missing-seeded-files.tsv"
        ;;
      default_icon/*)
        [ -f "$target" ] || die "referenced default icon is missing from source and target seed: $key"
        printf '%s\tseeded-target-fallback\n' "$key" >> "$run_dir/source-missing-seeded-files.tsv"
        ;;
      *) die "referenced MinIO object is missing: $key" ;;
    esac
  done < "$refs"
  rm -f "$tmp" "$refs"
  [ -s "$list" ] || die 'no referenced MinIO objects found in source export'
}

copy_source_files() {
  local run_dir="$1" key size digest target tmp actual_size actual_digest reason fallback_key
  [ -s "$run_dir/source-minio-files.tsv" ] || build_source_file_manifest "$run_dir"
  while IFS=$'\t' read -r key size digest; do
    normalize_object_key "$key" >/dev/null || die "unsafe referenced object key: $key"
    target="$TARGET_STORAGE_ROOT/$key"
    mkdir -p "$(dirname "$target")"
    tmp="$target.cutover-tmp"
    source_minio_cat "$key" > "$tmp"
    actual_size="$(wc -c < "$tmp" | tr -d ' ')"
    actual_digest="$(sha256_file "$tmp")"
    [ "$actual_size" = "$size" ] && [ "$actual_digest" = "$digest" ] || {
      rm -f "$tmp"
      die "copied object verification failed: $key"
    }
    mv "$tmp" "$target"
  done < "$run_dir/source-minio-files.tsv"
  if [ -s "$run_dir/source-missing-seeded-files.tsv" ]; then
    while IFS=$'\t' read -r key reason; do
      case "$reason" in
        seeded-substitution:*)
          fallback_key="${reason#seeded-substitution:}"
          [ -f "$TARGET_STORAGE_ROOT/$fallback_key" ] || die "seeded substitution source is missing: $fallback_key"
          target="$TARGET_STORAGE_ROOT/$key"
          mkdir -p "$(dirname "$target")"
          cp "$TARGET_STORAGE_ROOT/$fallback_key" "$target"
          ;;
        seeded-target-fallback) [ -f "$TARGET_STORAGE_ROOT/$key" ] || die "seeded fallback is missing: $key" ;;
        *) die "unknown seeded fallback reason for $key: $reason" ;;
      esac
    done < "$run_dir/source-missing-seeded-files.tsv"
  fi
}

validate_source_files() {
  local run_dir="$1" report="$2" key size digest target actual_size actual_digest reason failed=0
  [ -s "$run_dir/source-minio-files.tsv" ] || return 1
  while IFS=$'\t' read -r key size digest; do
    target="$TARGET_STORAGE_ROOT/$key"
    if [ ! -f "$target" ]; then
      printf 'file key=%s status=missing\n' "$key" >> "$report"
      failed=1
      continue
    fi
    actual_size="$(wc -c < "$target" | tr -d ' ')"
    actual_digest="$(sha256_file "$target")"
    printf 'file key=%s expected_size=%s actual_size=%s hash_match=%s\n' \
      "$key" "$size" "$actual_size" "$([ "$digest" = "$actual_digest" ] && printf true || printf false)" >> "$report"
    [ "$size" = "$actual_size" ] && [ "$digest" = "$actual_digest" ] || failed=1
  done < "$run_dir/source-minio-files.tsv"
  if [ -s "$run_dir/source-missing-seeded-files.tsv" ]; then
    while IFS=$'\t' read -r key reason; do
      target="$TARGET_STORAGE_ROOT/$key"
      printf 'file key=%s fallback=%s exists=%s\n' "$key" "$reason" "$([ -f "$target" ] && printf true || printf false)" >> "$report"
      [ -f "$target" ] || failed=1
    done < "$run_dir/source-missing-seeded-files.tsv"
  fi
  [ "$failed" = 0 ]
}

table_count() {
  local side="$1" table="$2"
  if [ "$side" = source ]; then
    source_mysql "$SOURCE_DATABASE" -e "SELECT COUNT(*) FROM \`$table\`;"
  else
    target_mysql "$TARGET_DATABASE" -e "SELECT COUNT(*) FROM \`$table\`;"
  fi
}

schema_signature() {
  local side="$1" table="$2" sql
  sql="SELECT column_name,column_type,is_nullable,COALESCE(column_default,'<NULL>') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$table' ORDER BY ordinal_position;"
  if [ "$side" = source ]; then
    source_mysql "$SOURCE_DATABASE" -e "$sql"
  else
    target_mysql "$TARGET_DATABASE" -e "$sql"
  fi
}

run_preflight() {
  local run_id="${1:-$(date +%Y%m%d-%H%M%S)}" run_dir manifest table source_sig target_sig value workflow_ids excluded_ids
  run_id="$(normalize_run_id "$run_id")"
  load_target_env
  require_command docker
  require_command tar
  require_command awk
  require_command shasum
  require_container_running "$SOURCE_MYSQL_CONTAINER"
  require_container_running "$SOURCE_MINIO_CONTAINER"
  require_container_running "$TARGET_MYSQL_CONTAINER"
  run_dir="$(create_run_dir "$run_id")"
  manifest="$run_dir/manifest.env"
  : > "$manifest"
  chmod 600 "$manifest"
  write_manifest_value "$manifest" run_id "$run_id"
  write_manifest_value "$manifest" source_database "$SOURCE_DATABASE"
  write_manifest_value "$manifest" target_database "$TARGET_DATABASE"
  workflow_ids="$(eligible_workflow_ids)"
  workflow_source_where workflow_meta "$workflow_ids" >/dev/null
  excluded_ids="$(excluded_workflow_ids)"
  write_manifest_value "$manifest" included_workflow_ids "$workflow_ids"
  write_manifest_value "$manifest" excluded_workflow_ids "$excluded_ids"
  for table in $MIGRATION_TABLES; do
    source_sig="$(schema_signature source "$table")"
    target_sig="$(schema_signature target "$table")"
    [ -n "$source_sig" ] || die "source table missing or empty schema: $table"
    [ "$source_sig" = "$target_sig" ] || die "schema mismatch for table: $table"
    value="$(source_migration_count "$table" "$workflow_ids")"
    write_manifest_value "$manifest" "source_count_$table" "$value"
    value="$(table_count target "$table")"
    write_manifest_value "$manifest" "target_before_count_$table" "$value"
  done
  value="$(source_mysql "$SOURCE_DATABASE" -e 'SELECT COUNT(*) FROM workflow_meta m LEFT JOIN workflow_draft d ON d.id=m.id WHERE d.id IS NULL;')"
  [ "$value" = 0 ] || die "source has $value workflow_meta rows without drafts"
  value="$(source_mysql "$SOURCE_DATABASE" -e 'SELECT COUNT(*) FROM workflow_draft d LEFT JOIN workflow_meta m ON m.id=d.id WHERE m.id IS NULL;')"
  [ "$value" = 0 ] || die "source has $value drafts without workflow_meta"
  value="$(source_mysql "$SOURCE_DATABASE" -e 'SELECT COUNT(*) FROM workflow_version v LEFT JOIN workflow_meta m ON m.id=v.workflow_id WHERE m.id IS NULL;')"
  [ "$value" = 0 ] || die "source has $value orphan versions"
  value="$(source_mysql "$SOURCE_DATABASE" -e 'SELECT COUNT(*) FROM workflow_meta m LEFT JOIN workflow_version v ON v.workflow_id=m.id AND v.version=m.latest_version WHERE COALESCE(m.latest_version,CHAR(0))<>CHAR(0) AND v.id IS NULL;')"
  [ "$value" = 0 ] || die "source has $value broken latest_version values"
  write_manifest_value "$manifest" status preflight_ok
  log "Preflight passed. Run ID: $run_id"
  log "Manifest: $manifest"
}

run_backup() {
  local run_id run_dir manifest status file table workflow_ids where
  run_id="$(normalize_run_id "$1")"
  run_dir="$CUTOVER_ROOT/$run_id"
  load_target_env
  manifest="$run_dir/manifest.env"
  [ -f "$manifest" ] || die "preflight manifest not found for run: $run_id"
  status="$(manifest_value "$manifest" status)"
  [ "$status" = preflight_ok ] || die "run is not ready for backup: $status"
  workflow_ids="$(manifest_value "$manifest" included_workflow_ids)"
  workflow_source_where workflow_meta "$workflow_ids" >/dev/null
  source_dump "$SOURCE_DATABASE" user space space_user > "$run_dir/source-selected.sql"
  for table in workflow_meta workflow_draft workflow_version workflow_reference; do
    where="$(workflow_source_where "$table" "$workflow_ids")"
    source_dump_where "$SOURCE_DATABASE" "$table" "$where" >> "$run_dir/source-selected.sql"
  done
  build_source_file_manifest "$run_dir"
  target_dump "$TARGET_DATABASE" $CLEAR_TABLES > "$run_dir/target-before.sql"
  mkdir -p "$TARGET_STORAGE_ROOT"
  tar -C "$TARGET_STORAGE_ROOT" -czf "$run_dir/storage-before.tar.gz" .
  for file in source-selected.sql target-before.sql storage-before.tar.gz; do
    [ -s "$run_dir/$file" ] || die "backup artifact is empty: $file"
    write_manifest_value "$manifest" "sha256_${file//[^A-Za-z0-9]/_}" "$(sha256_file "$run_dir/$file")"
  done
  write_manifest_value "$manifest" sha256_source_minio_files_tsv "$(sha256_file "$run_dir/source-minio-files.tsv")"
  write_manifest_value "$manifest" status backup_ok
  log "Backup passed. Run ID: $run_id"
}

clear_target_tables() {
  local sql='SET FOREIGN_KEY_CHECKS=0;' table
  for table in $CLEAR_TABLES; do
    sql="$sql DELETE FROM \`$table\`;"
  done
  sql="$sql SET FOREIGN_KEY_CHECKS=1;"
  target_mysql "$TARGET_DATABASE" -e "$sql"
}

run_validate() {
  local run_id run_dir manifest report table expected actual value failed=0
  run_id="$(normalize_run_id "$1")"
  run_dir="$CUTOVER_ROOT/$run_id"
  load_target_env
  manifest="$run_dir/manifest.env"
  [ -f "$manifest" ] || die "manifest not found for run: $run_id"
  report="$run_dir/validation.txt"
  : > "$report"
  for table in $MIGRATION_TABLES; do
    expected="$(manifest_value "$manifest" "source_count_$table")"
    actual="$(table_count target "$table")"
    printf '%s expected=%s actual=%s\n' "$table" "$expected" "$actual" >> "$report"
    [ "$expected" = "$actual" ] || failed=1
  done
  value="$(target_mysql "$TARGET_DATABASE" -e 'SELECT COUNT(*) FROM workflow_meta m LEFT JOIN workflow_draft d ON d.id=m.id WHERE d.id IS NULL;')"
  printf 'meta_without_draft=%s\n' "$value" >> "$report"; [ "$value" = 0 ] || failed=1
  value="$(target_mysql "$TARGET_DATABASE" -e 'SELECT COUNT(*) FROM workflow_draft d LEFT JOIN workflow_meta m ON m.id=d.id WHERE m.id IS NULL;')"
  printf 'draft_without_meta=%s\n' "$value" >> "$report"; [ "$value" = 0 ] || failed=1
  value="$(target_mysql "$TARGET_DATABASE" -e 'SELECT COUNT(*) FROM workflow_version v LEFT JOIN workflow_meta m ON m.id=v.workflow_id WHERE m.id IS NULL;')"
  printf 'orphan_version=%s\n' "$value" >> "$report"; [ "$value" = 0 ] || failed=1
  value="$(target_mysql "$TARGET_DATABASE" -e 'SELECT COUNT(*) FROM workflow_meta m LEFT JOIN workflow_version v ON v.workflow_id=m.id AND v.version=m.latest_version WHERE COALESCE(m.latest_version,CHAR(0))<>CHAR(0) AND v.id IS NULL;')"
  printf 'broken_latest_version=%s\n' "$value" >> "$report"; [ "$value" = 0 ] || failed=1
  value="$(target_mysql "$TARGET_DATABASE" -e 'SELECT COUNT(*) FROM workflow_meta m WHERE NOT EXISTS (SELECT 1 FROM space s WHERE s.id=m.space_id) OR NOT EXISTS (SELECT 1 FROM user u WHERE u.id=m.creator_id) OR NOT EXISTS (SELECT 1 FROM space_user su WHERE su.space_id=m.space_id AND su.user_id=m.creator_id);')"
  printf 'invalid_workflow_owner=%s\n' "$value" >> "$report"; [ "$value" = 0 ] || failed=1
  for table in workflow_execution node_execution workflow_snapshot; do
    value="$(table_count target "$table")"
    printf '%s=%s\n' "$table" "$value" >> "$report"; [ "$value" = 0 ] || failed=1
  done
  validate_source_files "$run_dir" "$report" || failed=1
  [ "$failed" = 0 ] || die "validation failed; see $report"
  write_manifest_value "$manifest" status cutover_ok
  log "Validation passed. Report: $report"
}

run_migrate() {
  local run_id run_dir manifest status
  run_id="$(normalize_run_id "$1")"
  run_dir="$CUTOVER_ROOT/$run_id"
  load_target_env
  manifest="$run_dir/manifest.env"
  [ -f "$manifest" ] || die "manifest not found for run: $run_id"
  status="$(manifest_value "$manifest" status)"
  case "$status" in
    backup_ok|cutover_ok|rollback_ok) ;;
    *) die "run is not ready for migration: $status" ;;
  esac
  clear_target_tables
  docker exec -i "$TARGET_MYSQL_CONTAINER" sh -lc \
    'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$1"' sh "$TARGET_DATABASE" < "$run_dir/source-selected.sql"
  copy_source_files "$run_dir"
  run_validate "$run_id"
}

run_rollback() {
  local run_id run_dir manifest file expected actual
  run_id="$(normalize_run_id "$1")"
  run_dir="$CUTOVER_ROOT/$run_id"
  load_target_env
  manifest="$run_dir/manifest.env"
  [ -f "$manifest" ] || die "manifest not found for run: $run_id"
  for file in source-selected.sql target-before.sql storage-before.tar.gz; do
    expected="$(manifest_value "$manifest" "sha256_${file//[^A-Za-z0-9]/_}")"
    actual="$(sha256_file "$run_dir/$file")"
    [ -n "$expected" ] && [ "$expected" = "$actual" ] || die "backup checksum mismatch: $file"
  done
  target_dump "$TARGET_DATABASE" $CLEAR_TABLES > "$run_dir/failed-state-before-rollback.sql"
  clear_target_tables
  docker exec -i "$TARGET_MYSQL_CONTAINER" sh -lc \
    'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$1"' sh "$TARGET_DATABASE" < "$run_dir/target-before.sql"
  mkdir -p "$TARGET_STORAGE_ROOT"
  find "$TARGET_STORAGE_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar -C "$TARGET_STORAGE_ROOT" -xzf "$run_dir/storage-before.tar.gz"
  write_manifest_value "$manifest" status rollback_ok
  log "Rollback completed for run: $run_id"
}

usage() {
  printf 'Usage: %s <preflight|backup|migrate|validate|rollback> [--run-id ID] [--confirm]\n' "$0"
}

main() {
  local action="${1:-}" run_id='' confirmed=false
  [ -n "$action" ] || { usage >&2; return 2; }
  shift || true
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --run-id) [ "$#" -ge 2 ] || die '--run-id requires a value'; run_id="$2"; shift 2 ;;
      --confirm) confirmed=true; shift ;;
      *) die "unknown argument: $1" ;;
    esac
  done
  case "$action" in
    preflight|backup|migrate|validate|rollback) ;;
    *) usage >&2; return 2 ;;
  esac
  case "$action" in
    migrate|rollback) require_destructive_confirmation "$action" "$run_id" "$confirmed" ;;
  esac
  case "$action" in
    preflight) run_preflight "$run_id" ;;
    backup) [ -n "$run_id" ] || die 'backup requires --run-id'; run_backup "$run_id" ;;
    migrate) run_migrate "$run_id" ;;
    validate) [ -n "$run_id" ] || die 'validate requires --run-id'; run_validate "$run_id" ;;
    rollback) run_rollback "$run_id" ;;
  esac
}

if [ "${WORKFLOW_CUTOVER_LIB_ONLY:-0}" != 1 ]; then
  main "$@"
fi
