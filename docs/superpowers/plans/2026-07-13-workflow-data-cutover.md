# Workflow Data Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely replace the workflow-only target database with selected account/workflow data from `coze-studio-debug`, copy referenced MinIO objects to local storage, validate the cutover, and retain a tested rollback path.

**Architecture:** A single auditable Bash entry point exposes `preflight`, `backup`, `migrate`, `validate`, and `rollback` actions. It uses Docker container-local MySQL clients, explicit table lists, timestamped run directories, and manifest files; destructive actions require both a run ID and `--confirm`. A shell self-test exercises guards and pure helpers before the script is used against the real containers.

**Tech Stack:** Bash 3.2-compatible shell, Docker Compose, MySQL 8.4 clients, `mysqldump`, SHA-256 tools, existing Make targets, local filesystem storage.

## Global Constraints

- Migrate `user`, `space`, `space_user`, `workflow_meta`, `workflow_draft`, `workflow_version`, and `workflow_reference` only.
- Include only workflows whose creator and space exist and whose creator is a member of that space; record excluded workflow IDs in the run manifest.
- Do not migrate `workflow_execution`, `node_execution`, or `workflow_snapshot`.
- Replace all existing target workflows after backing them up.
- Preserve source IDs, timestamps, soft-delete values, versions, and workflow references.
- Never print or persist database passwords.
- Never clear the target until preflight and backup have succeeded.
- Preserve `_mirap_schema_migrations`.
- Copy only workflow-referenced objects from the `opencoze` MinIO bucket.
- Existing unrelated dirty-worktree changes must not be modified or committed.

---

### Task 1: Cutover script guardrails and helper tests

**Files:**
- Create: `scripts/workflow_data_cutover.sh`
- Create: `scripts/workflow_data_cutover_test.sh`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Docker container names `coze-mysql`, `coze-minio`, `mirap-workflow-mysql`; source database `opencoze`; target settings from `docker/.env.workflow`.
- Produces: `scripts/workflow_data_cutover.sh <preflight|backup|migrate|validate|rollback> [--run-id ID] [--confirm]`.

- [ ] **Step 1: Write the failing shell self-test**

Create a test harness that sources the script with `WORKFLOW_CUTOVER_LIB_ONLY=1`, creates a temporary run root, and asserts:

```bash
assert_eq "$(normalize_object_key 'default_icon/default_workflow_icon.png')" "default_icon/default_workflow_icon.png"
assert_fails normalize_object_key '../mysql/ibdata1'
assert_fails normalize_object_key '/etc/passwd'
assert_fails require_destructive_confirmation migrate run-1 false
assert_eq "$(csv_join user space workflow_meta)" "user,space,workflow_meta"
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `bash scripts/workflow_data_cutover_test.sh`

Expected: FAIL because the entry point and helpers do not exist.

- [ ] **Step 3: Implement the command parser and pure helpers**

Implement these exact public helper signatures:

```bash
normalize_object_key
csv_join
require_command
require_container_running
require_destructive_confirmation
create_run_dir
write_manifest_value
```

Use:

```bash
MIGRATION_TABLES="user space space_user workflow_meta workflow_draft workflow_version workflow_reference"
CLEAR_TABLES="workflow_reference workflow_version workflow_draft workflow_meta space_user space user node_execution workflow_snapshot workflow_execution files"
```

Reject unknown actions, missing run IDs for destructive actions, source/target equality, and an unexpected target database.

- [ ] **Step 4: Ignore artifacts**

Append `backups/workflow-cutover/` to `.gitignore`.

- [ ] **Step 5: Run helper tests**

Run: `bash scripts/workflow_data_cutover_test.sh`

Expected: PASS.

### Task 2: Preflight, backup, and rollback

**Files:**
- Modify: `scripts/workflow_data_cutover.sh`
- Modify: `scripts/workflow_data_cutover_test.sh`

**Interfaces:**
- Consumes: Task 1 parser/helpers and container-local credentials.
- Produces: `preflight`, `backup`, and `rollback`, plus `manifest.env`, `source-selected.sql`, `target-before.sql`, and `storage-before.tar.gz`.

- [ ] **Step 1: Extend tests for state transitions**

Use fake Docker/checksum commands on `PATH`. Verify backup refuses a missing preflight marker, rollback refuses an incomplete run, and status transitions only through `preflight_ok`, `backup_ok`, and `rollback_ok`.

- [ ] **Step 2: Run tests and verify failure**

Run: `bash scripts/workflow_data_cutover_test.sh`

Expected: FAIL on missing actions.

- [ ] **Step 3: Implement preflight**

Require needed commands and running containers; check both databases, character sets, and exact schema compatibility. Record exact source/target counts. Assert zero meta-without-draft, draft-without-meta, orphan versions, and broken latest versions.

If source `space_user` is absent or empty, export one owner membership per space with `role_type=1` and record `space_user_mode=synthesized`; otherwise migrate it directly.

- [ ] **Step 4: Implement backup**

Generate:

```text
source-selected.sql
target-before.sql
storage-before.tar.gz
source-minio-files.tsv
manifest.env
```

Use explicit tables and columns, validate nonempty artifacts, store SHA-256 values, and mark `status=backup_ok` only at the end.

- [ ] **Step 5: Implement rollback**

Require `--run-id` and `--confirm`; validate manifest checksums; save `failed-state-before-rollback.sql`; clear target tables; restore target SQL and local storage; verify pre-cutover counts. Never modify source services.

- [ ] **Step 6: Verify**

Run: `bash scripts/workflow_data_cutover_test.sh && bash -n scripts/workflow_data_cutover.sh`

Expected: PASS.

### Task 3: Migration and validation

**Files:**
- Modify: `scripts/workflow_data_cutover.sh`
- Modify: `scripts/workflow_data_cutover_test.sh`

**Interfaces:**
- Consumes: a `backup_ok` run.
- Produces: migrated data, copied local files, `validation.txt`, and `status=cutover_ok`.

- [ ] **Step 1: Add failing behavior tests**

Assert import/clear order, preservation of migration metadata, omission of history tables from source export, unsafe-key rejection, and failure on count or relationship mismatch.

- [ ] **Step 2: Run tests and verify failure**

Run: `bash scripts/workflow_data_cutover_test.sh`

Expected: FAIL.

- [ ] **Step 3: Implement migrate**

Require matching run ID and confirmation. Clear `CLEAR_TABLES` in one target session with foreign-key checks disabled, import source data, and reset auto-increments. Copy only listed MinIO keys through temporary files and atomic rename. Keep plain object keys unchanged; rewrite absolute old URLs only through a generated mapping.

- [ ] **Step 4: Implement validate**

Write `validation.txt` and require:

```text
seven migrated table counts equal source
meta_without_draft=0
draft_without_meta=0
orphan_version=0
broken_latest_version=0
invalid_workflow_reference=0
workflow_execution=0
node_execution=0
workflow_snapshot=0
all referenced file sizes and hashes match
```

Extract node types from draft/version canvas JSON and compare with the workflow-only enabled-node list, reporting workflow/version and unexpected type.

- [ ] **Step 5: Verify**

Run: `bash scripts/workflow_data_cutover_test.sh && bash -n scripts/workflow_data_cutover.sh`

Expected: PASS.

### Task 4: Operator entry points and documentation

**Files:**
- Modify: `Makefile`
- Modify: `docs/mirap-workflow-dev-environment.md`
- Modify: `docs/mirap-workflow-extraction-plan.md`

- [ ] **Step 1: Add Make targets**

Add `workflow-cutover-preflight`, `workflow-cutover-backup`, `workflow-cutover-migrate`, `workflow-cutover-validate`, and `workflow-cutover-rollback`. Pass `RUN_ID` to all run-bound actions and `--confirm` only from destructive targets.

- [ ] **Step 2: Document the operator flow**

Document prerequisites, run ID discovery, backup, migration, validation, smoke, rollback, artifact paths, and the exclusion of execution history/snapshots.

- [ ] **Step 3: Update phase state**

Mark phase 10 `进行中` before the real cutover. Record actual evidence only after it occurs.

- [ ] **Step 4: Verify**

Run: `make help | rg 'workflow-cutover'` and `git diff --check`.

Expected: all five targets are listed and whitespace checks pass.

### Task 5: Real cutover and rollback drill

**Files:**
- Runtime: `backups/workflow-cutover/<run-id>/`
- Modify after evidence: `docs/mirap-workflow-extraction-plan.md`

- [ ] **Step 1: Preflight and backup**

Run:

```bash
make workflow-migrate
make workflow-cutover-preflight
make workflow-cutover-backup RUN_ID=<reported-run-id>
```

Expected selected counts: user 2, space 2, workflow_meta 7, workflow_draft 7, workflow_version 13, workflow_reference 1; source workflow `id=1` is excluded because its creator and space do not exist. Final status: `backup_ok`.

- [ ] **Step 2: Migrate**

Run: `make workflow-cutover-migrate RUN_ID=<run-id>`

Expected: target validation fixtures are absent and import completes.

- [ ] **Step 3: Validate**

Run: `make workflow-cutover-validate RUN_ID=<run-id>`

Expected: all equality/relationship/history/file checks pass and status becomes `cutover_ok`.

- [ ] **Step 4: Validate service behavior**

Run `make workflow-smoke`; reopen representative migrated all-node, subworkflow parent/child, and upload-reference workflows; verify save/reopen/publish/execute.

- [ ] **Step 5: Prove rollback and reapply**

Rollback the verified run, confirm the nine old target workflows return, then reapply the preserved source export and validate again. Do not alter the source.

- [ ] **Step 6: Final verification**

Run:

```bash
bash scripts/workflow_data_cutover_test.sh
bash -n scripts/workflow_data_cutover.sh
make test
make build
make workflow-smoke
git diff --check
```

Expected: all pass; record exact evidence in phase 10.
