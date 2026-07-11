#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:8889}"
COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose-workflow.yml}"
DOCKER_ENV_FILE="${DOCKER_ENV_FILE:-docker/.env.workflow}"
MYSQL_SERVICE="${MYSQL_SERVICE:-workflow-mysql}"
MYSQL_USER="${WORKFLOW_MYSQL_USER:-mirap}"
MYSQL_PASSWORD="${WORKFLOW_MYSQL_PASSWORD:-mirap123}"
MYSQL_DATABASE="${WORKFLOW_MYSQL_DATABASE:-mirap_workflow}"
SMOKE_USER_ID="${WORKFLOW_AUTH_BYPASS_USER_ID:-10001}"
SMOKE_SPACE_ID="${WORKFLOW_SMOKE_SPACE_ID:-999999}"
RUN_ID="$(date +%Y%m%d%H%M%S)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/workflow-smoke.XXXXXX")"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

log() {
  printf '[workflow-smoke] %s\n' "$*"
}

mysql_exec() {
  docker compose -f "$ROOT_DIR/$COMPOSE_FILE" --env-file "$ROOT_DIR/$DOCKER_ENV_FILE" \
    exec -T "$MYSQL_SERVICE" mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" "$@"
}

post_json() {
  local path="$1"
  local body_file="$2"
  curl -fsS -X POST "$BASE_URL$path" \
    -H 'Content-Type: application/json' \
    --data-binary "@$body_file"
}

assert_code_zero() {
  local response_file="$1"
  local label="$2"
  if ! jq -e '.code == 0' "$response_file" >/dev/null; then
    log "$label failed:"
    cat "$response_file"
    return 1
  fi
}

require_field() {
  local response_file="$1"
  local jq_expr="$2"
  local label="$3"
  if ! jq -er "$jq_expr" "$response_file" >/dev/null; then
    log "$label missing in response:"
    cat "$response_file"
    return 1
  fi
}

file_upload_check() {
  log "checking local file upload/read access"
  printf 'workflow smoke upload %s\n' "$RUN_ID" >"$TMP_DIR/upload.txt"

  curl -fsS -X POST "$BASE_URL/api/files/upload" \
    -F "file=@$TMP_DIR/upload.txt;type=text/plain" \
    >"$TMP_DIR/upload-response.json"

  require_field "$TMP_DIR/upload-response.json" '.key' "uploaded file key"
  require_field "$TMP_DIR/upload-response.json" '.url' "uploaded file url"

  local file_key file_url
  file_key="$(jq -er '.key' "$TMP_DIR/upload-response.json")"
  file_url="$(jq -er '.url' "$TMP_DIR/upload-response.json")"
  if [[ "$file_key" != uploads/${SMOKE_USER_ID}/* ]]; then
    log "uploaded file key has unexpected owner prefix: $file_key"
    return 1
  fi

  curl -fsS "$BASE_URL$file_url" >"$TMP_DIR/upload-read.txt"
  if ! cmp -s "$TMP_DIR/upload.txt" "$TMP_DIR/upload-read.txt"; then
    log "uploaded file content mismatch"
    return 1
  fi

  local forbidden_status
  forbidden_status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/files/uploads/10002/not-owned.txt")"
  if [[ "$forbidden_status" != "403" ]]; then
    log "expected private file owner check to return 403, got $forbidden_status"
    return 1
  fi

  log "checking local file delete access"
  local delete_response
  delete_response="$(curl -fsS -X DELETE "$BASE_URL/api/files/$file_key")"
  if ! echo "$delete_response" | jq -e '.status == "deleted"' >/dev/null; then
    log "delete did not return deleted status: $delete_response"
    return 1
  fi

  local after_delete_status
  after_delete_status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/files/$file_key")"
  if [[ "$after_delete_status" != "404" ]]; then
    log "expected 404 after delete, got $after_delete_status"
    return 1
  fi

  local delete_forbidden_status
  delete_forbidden_status="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$BASE_URL/api/files/uploads/10002/not-owned.txt")"
  if [[ "$delete_forbidden_status" != "403" ]]; then
    log "expected delete cross-owner check to return 403, got $delete_forbidden_status"
    return 1
  fi
}

seed_smoke_identity() {
  log "seeding smoke user/space in isolated database"
  mysql_exec <<SQL
INSERT INTO user (id,name,unique_name,email,password,description,icon_uri,user_verified,locale,session_key,created_at,updated_at)
VALUES (${SMOKE_USER_ID},'Workflow Smoke','workflow_smoke','workflow-smoke@mirap.local','','','default_icon/user_default_icon.png',1,'zh-CN','',UNIX_TIMESTAMP(NOW(3))*1000,UNIX_TIMESTAMP(NOW(3))*1000)
ON DUPLICATE KEY UPDATE name=VALUES(name), updated_at=VALUES(updated_at);

INSERT INTO space (id,owner_id,name,description,icon_uri,creator_id,created_at,updated_at)
VALUES (${SMOKE_SPACE_ID},${SMOKE_USER_ID},'Workflow Smoke Space','workflow-only smoke space','default_icon/team_default_icon.png',${SMOKE_USER_ID},UNIX_TIMESTAMP(NOW(3))*1000,UNIX_TIMESTAMP(NOW(3))*1000)
ON DUPLICATE KEY UPDATE owner_id=VALUES(owner_id), name=VALUES(name), updated_at=VALUES(updated_at);

INSERT INTO space_user (space_id,user_id,role_type,created_at,updated_at)
VALUES (${SMOKE_SPACE_ID},${SMOKE_USER_ID},1,UNIX_TIMESTAMP(NOW(3))*1000,UNIX_TIMESTAMP(NOW(3))*1000)
ON DUPLICATE KEY UPDATE role_type=VALUES(role_type), updated_at=VALUES(updated_at);
SQL
}

health_check() {
  log "checking health endpoint"
  curl -fsS "$BASE_URL/healthz" | jq -e '.status == "ok"' >/dev/null
  curl -fsS "$BASE_URL/assets/default_icon/workflow_icon/icon-start.jpg" >/dev/null
}

create_workflow() {
  local name="$1"
  local desc="$2"
  local out_file="$3"

  jq -n \
    --arg space_id "$SMOKE_SPACE_ID" \
    --arg name "$name" \
    --arg desc "$desc" \
    '{space_id:$space_id,name:$name,desc:$desc,icon_uri:"default_icon/default_workflow_icon.png"}' \
    >"$TMP_DIR/create.json"

  post_json "/api/workflow_api/create" "$TMP_DIR/create.json" >"$out_file"
  assert_code_zero "$out_file" "create workflow"
  require_field "$out_file" '.data.workflow_id' "workflow_id"
}

get_canvas() {
  local workflow_id="$1"
  local out_file="$2"

  jq -n --arg space_id "$SMOKE_SPACE_ID" --arg workflow_id "$workflow_id" \
    '{space_id:$space_id,workflow_id:$workflow_id}' >"$TMP_DIR/canvas.json"

  post_json "/api/workflow_api/canvas" "$TMP_DIR/canvas.json" >"$out_file"
  assert_code_zero "$out_file" "get canvas"
  require_field "$out_file" '.data.vcs_data.submit_commit_id' "submit_commit_id"
}

save_schema() {
  local workflow_id="$1"
  local commit_id="$2"
  local name="$3"
  local desc="$4"
  local schema_file="$5"
  local out_file="$6"

  jq -n \
    --arg workflow_id "$workflow_id" \
    --arg space_id "$SMOKE_SPACE_ID" \
    --arg commit_id "$commit_id" \
    --arg name "$name" \
    --arg desc "$desc" \
    --rawfile schema "$schema_file" \
    '{workflow_id:$workflow_id,space_id:$space_id,submit_commit_id:$commit_id,name:$name,desc:$desc,icon_uri:"default_icon/default_workflow_icon.png",schema:$schema}' \
    >"$TMP_DIR/save.json"

  post_json "/api/workflow_api/validate_tree" "$TMP_DIR/save.json" >"$TMP_DIR/validate.json"
  assert_code_zero "$TMP_DIR/validate.json" "validate tree"

  post_json "/api/workflow_api/save" "$TMP_DIR/save.json" >"$out_file"
  assert_code_zero "$out_file" "save workflow"
}

publish_workflow() {
  local workflow_id="$1"
  local commit_id="$2"
  local version="$3"
  local out_file="$4"

  jq -n \
    --arg workflow_id "$workflow_id" \
    --arg space_id "$SMOKE_SPACE_ID" \
    --arg commit_id "$commit_id" \
    --arg version "$version" \
    '{workflow_id:$workflow_id,space_id:$space_id,has_collaborator:false,commit_id:$commit_id,force:true,workflow_version:$version,version_description:"workflow-only smoke"}' \
    >"$TMP_DIR/publish.json"

  post_json "/api/workflow_api/publish" "$TMP_DIR/publish.json" >"$out_file"
  assert_code_zero "$out_file" "publish workflow"

  local count
  count="$(mysql_exec --batch --silent --raw --skip-column-names \
    -e "SELECT COUNT(*) FROM workflow_version WHERE workflow_id=${workflow_id} AND version='${version}' AND commit_id='${commit_id}';" |
    awk '/^[0-9]+$/ { value=$1 } END { print value }')"
  if [[ "$count" != "1" ]]; then
    log "published workflow_version row not found for workflow_id=${workflow_id}, version=${version}, commit_id=${commit_id}"
    return 1
  fi
}

node_type_check() {
  local workflow_id="$1"

  jq -n --arg space_id "$SMOKE_SPACE_ID" --arg workflow_id "$workflow_id" \
    '{space_id:$space_id,workflow_id:$workflow_id}' >"$TMP_DIR/node-type.json"

  post_json "/api/workflow_api/node_type" "$TMP_DIR/node-type.json" >"$TMP_DIR/node-type-response.json"
  assert_code_zero "$TMP_DIR/node-type-response.json" "node_type"
  require_field "$TMP_DIR/node-type-response.json" '.data.node_types | length' "node_types"
}

write_minimal_schema() {
  local out_file="$1"

  jq -n '{
    nodes: [
      {
        id: "100001",
        type: "1",
        meta: {position: {x: 0, y: 0}},
        data: {
          nodeMeta: {title: "Start", subTitle: "", description: "Workflow entry", icon: "default_icon/workflow_icon/icon-start.jpg"},
          outputs: [{name: "input", type: "string", required: false}],
          trigger_parameters: [{name: "input", type: "string", required: false}]
        }
      },
      {
        id: "900001",
        type: "2",
        meta: {position: {x: 600, y: 0}},
        data: {
          nodeMeta: {title: "End", subTitle: "", description: "Workflow end", icon: "default_icon/workflow_icon/icon-end.jpg"},
          inputs: {
            terminatePlan: "returnVariables",
            inputParameters: [
              {
                name: "output",
                input: {
                  type: "string",
                  value: {type: "ref", content: {source: "block-output", blockID: "100001", name: "input"}, rawMeta: {type: 1}}
                }
              }
            ]
          }
        }
      }
    ],
    edges: [{sourceNodeID: "100001", targetNodeID: "900001"}],
    versions: {loop: "v2"}
  }' >"$out_file"
}

run_workflow() {
  local workflow_id="$1"

  jq -n --arg space_id "$SMOKE_SPACE_ID" --arg workflow_id "$workflow_id" \
    '{space_id:$space_id,workflow_id:$workflow_id,input:{input:"hello workflow"}}' \
    >"$TMP_DIR/test-run.json"

  post_json "/api/workflow_api/test_run" "$TMP_DIR/test-run.json" >"$TMP_DIR/test-run-response.json"
  assert_code_zero "$TMP_DIR/test-run-response.json" "test_run"
  local execute_id
  execute_id="$(jq -er '.data.execute_id' "$TMP_DIR/test-run-response.json")"

  local attempt
  for attempt in {1..20}; do
    curl -fsS "$BASE_URL/api/workflow_api/get_process?workflow_id=${workflow_id}&space_id=${SMOKE_SPACE_ID}&execute_id=${execute_id}" \
      >"$TMP_DIR/process-response.json"
    assert_code_zero "$TMP_DIR/process-response.json" "get_process"
    if jq -e '.data.executeStatus == 2 and (.data.nodeResults | length >= 2)' "$TMP_DIR/process-response.json" >/dev/null; then
      return 0
    fi
    sleep 0.2
  done

  if ! jq -e '.data.executeStatus == 2 and (.data.nodeResults | length >= 2)' "$TMP_DIR/process-response.json" >/dev/null; then
    log "workflow execution did not complete successfully:"
    cat "$TMP_DIR/process-response.json"
    return 1
  fi
}

main() {
  cd "$ROOT_DIR"

  health_check
  seed_smoke_identity

  log "checking workflow_list"
  jq -n --arg space_id "$SMOKE_SPACE_ID" '{space_id:$space_id,page:1,size:10}' >"$TMP_DIR/list.json"
  post_json "/api/workflow_api/workflow_list" "$TMP_DIR/list.json" >"$TMP_DIR/list-response.json"
  assert_code_zero "$TMP_DIR/list-response.json" "workflow_list"
  file_upload_check

  log "validating Mirap fixture save/reopen/publish path"
  create_workflow "mirap_fixture_smoke_${RUN_ID}" "Mirap fixture smoke" "$TMP_DIR/mirap-create-response.json"
  local mirap_workflow_id
  mirap_workflow_id="$(jq -er '.data.workflow_id' "$TMP_DIR/mirap-create-response.json")"
  get_canvas "$mirap_workflow_id" "$TMP_DIR/mirap-canvas-response.json"
  local mirap_commit_id
  mirap_commit_id="$(jq -er '.data.vcs_data.submit_commit_id' "$TMP_DIR/mirap-canvas-response.json")"
  save_schema "$mirap_workflow_id" "$mirap_commit_id" "mirap_fixture_smoke_${RUN_ID}" "Mirap fixture smoke" \
    "$ROOT_DIR/testdata/workflows/mirap-all-nodes.canvas.json" "$TMP_DIR/mirap-save-response.json"
  get_canvas "$mirap_workflow_id" "$TMP_DIR/mirap-reopen-response.json"
  local mirap_saved_commit_id
  mirap_saved_commit_id="$(jq -er '.data.vcs_data.submit_commit_id' "$TMP_DIR/mirap-reopen-response.json")"
  jq -e '(.data.workflow.schema_json | fromjson | .nodes[] | select(.id == "100001" or .id == "900001"))' \
    "$TMP_DIR/mirap-reopen-response.json" >/dev/null
  publish_workflow "$mirap_workflow_id" "$mirap_saved_commit_id" "v0.0.1" "$TMP_DIR/mirap-publish-response.json"
  node_type_check "$mirap_workflow_id"

  log "checking executable minimal workflow path"
  create_workflow "minimal_run_smoke_${RUN_ID}" "Minimal execution smoke" "$TMP_DIR/min-create-response.json"
  local min_workflow_id
  min_workflow_id="$(jq -er '.data.workflow_id' "$TMP_DIR/min-create-response.json")"
  get_canvas "$min_workflow_id" "$TMP_DIR/min-canvas-response.json"
  local min_commit_id
  min_commit_id="$(jq -er '.data.vcs_data.submit_commit_id' "$TMP_DIR/min-canvas-response.json")"
  write_minimal_schema "$TMP_DIR/minimal.canvas.json"
  save_schema "$min_workflow_id" "$min_commit_id" "minimal_run_smoke_${RUN_ID}" "Minimal execution smoke" \
    "$TMP_DIR/minimal.canvas.json" "$TMP_DIR/min-save-response.json"
  run_workflow "$min_workflow_id"

  log "smoke test passed"
}

main "$@"
