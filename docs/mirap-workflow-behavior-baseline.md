# Mirap Workflow behavior baseline

> Phase 0 baseline for `docs/mirap-workflow-extraction-plan.md`.
> Captured on 2026-07-10 in the original Coze Studio repository.

## Source revision

- Commit: `370eb2802966d331618dba3a7905b811c43ef3ac`
- Commit time: `2026-07-10T17:35:11+08:00`
- Commit subject: `feat: add MMSI set operations workflow nodes for intersection, union, and difference`
- Branch observed locally: `feat/compute-unit`

## Mirap node contract

The frontend `StandardNodeType` values and backend `NodeTypeMetas.ID` values are aligned for the Mirap nodes:

| ID | Frontend enum | Backend key | Notes |
|---:|---|---|---|
| 1001 | `MirapAreaShipExtractor` | `MirapAreaShipExtractor` | Fixed HTTP-style area ship extractor. |
| 1002 | `MirapMMSIIntersection` | `MirapMMSIIntersection` | MMSI set intersection. |
| 1003 | `MirapMMSIUnion` | `MirapMMSIUnion` | MMSI set union. |
| 1004 | `MirapMMSIDifference` | `MirapMMSIDifference` | MMSI set difference, requires `mainInputName`. |
| 1005 | `MirapStayCalculation` | `MirapStayCalculation` | Low-speed/stay calculation node. |
| 1006 | `MirapHoverDetail` | `MirapHoverDetail` | Turnback/hover detail node. |

Confirmed implementation points:

- Frontend enum: `frontend/packages/workflow/base/src/types/node-type.ts`
- Backend metadata: `backend/domain/workflow/entity/node_meta.go`
- Backend canvas adaptors: `backend/domain/workflow/internal/canvas/adaptor/to_schema.go`
- Frontend node-test coverage exists for:
  - `mirap-area-ship/node-test.ts`
  - `mirap-mmsi-set/node-test.ts`
  - `mirap-stay-calc/node-test.ts`
  - `mirap-hover-detail/node-test.ts`

## Existing database sample

The local `opencoze` database contained the following workflow data during capture.
The exported sanitized summary is stored in `testdata/mysql/workflow-baseline.json`.

| Table | Count |
|---|---:|
| `workflow_meta` | 4 |
| `workflow_draft` | 4 |
| `workflow_version` | 7 |
| `workflow_reference` | 0 |
| `workflow_execution` | 103 |
| `workflow_snapshot` | 94 |

Existing draft node coverage:

| Workflow | Covered node types |
|---|---|
| `split_messages` | `1`, `2`, `5`, `15`, `21`, `31` |
| `api_work_flow` | `1`, `2`, `5`, `45` |
| `node_calc_01` | `1`, `2`, `1001`, `1003`, `1005`, `1006` |
| `node_api_01` | `1`, `2`, `5`, `1001`, `1005` |

Coverage gap found during phase 0:

- No existing draft contains `1002` (`MirapMMSIIntersection`).
- No existing draft contains `1004` (`MirapMMSIDifference`).
- `workflow_reference` is empty, so no subworkflow baseline is currently available in the old local database.

The fixture `testdata/workflows/mirap-all-nodes.canvas.json` fills the schema coverage gap by including all six Mirap node types in one canvas.

## Live API baseline run

After the initial static baseline was captured, a live API baseline workflow was created in the old repository using the local account `codex-baseline-20260710@example.test`.

Observed values:

| Field | Value |
|---|---|
| Space ID | `7660920851843252224` |
| Workflow ID | `7660929648309567488` |
| Workflow name | `mirap_all_nodes_baseline_20260710` |
| Initial submit commit | `7660929649043570688` |
| Reopened submit commit after first save | `7660930593269481472` |
| Submit commit after second save | `7660932792477286400` |
| Published version | `v0.0.1` |
| Published commit | `7660932792477286400` |
| Published canvas length | `11885` |

Live API results:

| Operation | Result |
|---|---|
| Login | `POST /api/passport/web/email/login/` returned `code=0`. |
| Account check | `POST /api/passport/account/info/v2/` returned `code=0` when the `session_key` cookie was supplied manually. |
| Create workflow | `POST /api/workflow_api/create` returned workflow ID `7660929648309567488`. |
| Save workflow | `POST /api/workflow_api/save` returned `code=0`. |
| Reopen canvas | `POST /api/workflow_api/canvas` returned a schema with 8 nodes and 13 edges. |
| Modify/save again | A second `POST /api/workflow_api/save` returned `code=0` and produced submit commit `7660932792477286400`. |
| Force publish | `POST /api/workflow_api/publish` returned `success=true`. |
| Published version storage | `workflow_version` contains `v0.0.1` for workflow `7660929648309567488`. |

Live saved node coverage:

| Node type | Count |
|---|---:|
| `1` | 1 |
| `2` | 1 |
| `1001` | 1 |
| `1002` | 1 |
| `1003` | 1 |
| `1004` | 1 |
| `1005` | 1 |
| `1006` | 1 |

Notes from the live run:

- The backend currently sets `Set-Cookie: session_key=...; domain=localhost:8888`, which curl does not persist as a reusable cookie jar entry. For the live API run, the session key was extracted from the login response header and passed back as a manual `Cookie:` header. The session value is not stored in repository files.
- `POST /api/workflow_api/released_workflows` is currently an empty handler in `backend/api/handler/coze/workflow_service.go`; published version verification was therefore done against `workflow_version`.

## Subworkflow and upload live run

Additional live evidence was captured on 2026-07-11 to close the remaining phase 0 gaps.

Subworkflow baseline:

| Field | Value |
|---|---|
| Child workflow ID | `7660936046263140352` |
| Child published version | `v0.0.3` |
| Child published commit | `7660940929489960960` |
| Parent workflow ID | `7660938157419921408` |
| Parent published version | `v0.0.2` |
| Parent published commit | `7660941729377288192` |
| Reference row ID | `7660940025885884416` |
| Parent execute ID | `7660942326516154368` |
| Child execute ID | `7660942326746841088` |

Subworkflow live results:

| Operation | Result |
|---|---|
| Child save/reopen | Reopened schema has Start `100001`, End `900001`, and 1 edge. |
| Child publish | `POST /api/workflow_api/publish` returned `success=true` for `v0.0.3`. |
| Parent save/reopen | Reopened schema has Start `100001`, SubWorkflow `200001`, End `900001`, and references child `v0.0.3`. |
| Parent publish | `POST /api/workflow_api/publish` returned `success=true` for `v0.0.2`. |
| Reference persistence | `workflow_reference` has active row parent `7660938157419921408` -> child `7660936046263140352`, `refer_type=1`. |
| Parent run | `POST /api/workflow_api/test_run` returned `code=0`, execute ID `7660942326516154368`. |
| Child run from parent | `workflow_execution` contains child execution `7660942326746841088`, `parent_node_id=200001`, `status=2`. |

Upload/reopen baseline:

| Field | Value |
|---|---|
| Upload object key | `tos-cn-i-v4nquku3lp/mirap-phase0-upload-20260711.txt` |
| Upload response payload key | `4b4a5f85-804c-4fd2-ae1a-32811b4b59dd` |
| Upload workflow ID | `7660943337066594304` |
| Reopened submit commit | `7660943885761249280` |
| Reopened schema length | `2291` |

Upload live results:

| Operation | Result |
|---|---|
| File upload | `POST /api/common/upload/tos-cn-i-v4nquku3lp/mirap-phase0-upload-20260711.txt` returned `error.code=200`. |
| Save workflow with file value | `POST /api/workflow_api/save` returned `code=0`. |
| Reopen workflow | `POST /api/workflow_api/canvas` returned the same uploaded object key in the Start node file parameter. |

Table counts after live phase 0 completion:

| Table | Count |
|---|---:|
| `workflow_meta` | 8 |
| `workflow_draft` | 8 |
| `workflow_version` | 13 |
| `workflow_reference` | 1 |
| `workflow_execution` | 105 |
| `workflow_snapshot` | 95 |

## Core API baseline samples

Normalized request/response examples are stored in:

- `testdata/api/workflow/core-api-samples.json`

The samples cover these workflow API surfaces:

- `POST /api/workflow_api/create`
- `POST /api/workflow_api/canvas`
- `POST /api/workflow_api/save`
- `POST /api/workflow_api/publish`
- `POST /api/workflow_api/released_workflows`
- `POST /api/workflow_api/test_run`
- `POST /api/workflow_api/nodeDebug`

The examples intentionally use placeholder IDs and normalized responses so they can be committed safely and reused in the extracted repository.

## Node whitelist candidate

The phase 0 whitelist candidate is stored in:

- `testdata/workflows/node-whitelist.json`

It keeps general workflow control and data-shaping nodes plus the six Mirap nodes. AI, plugin, knowledge, conversation, image generation, database CRUD, and free code execution nodes are excluded from the extraction target unless business requirements later re-add them.

## Acceptance matrix

| Case | Status in this baseline | Evidence |
|---|---|---|
| Create workflow | Sampled | `core-api-samples.json` contains normalized request/response shape. |
| Save workflow | Sampled | `core-api-samples.json` and `mirap-all-nodes.canvas.json`. |
| Close and reopen | Sampled | `canvas` request/response sample. |
| Modify and save again | Sampled | `save` sample includes `submit_commit_id`. |
| Force publish | Verified by live API | Published workflow `7660929648309567488` with `force: true`. |
| Read published version | Verified by DB | `workflow_version` contains `v0.0.1`; `released_workflows` handler is currently empty. |
| Mirap single-node run | Live responses captured | `testdata/api/workflow/mirap-node-debug-live-samples.json` contains `nodeDebug` and `get_process` responses for all six nodes; three set-operation nodes succeeded and three HTTP-backed nodes recorded DNS failures. |
| Full Mirap workflow run | Partially covered | Existing `node_calc_01` has successful test-run flag and published versions; live all-node schema saved/reopened/published. |
| Subworkflow run | Verified by live API and DB | Parent execution `7660942326516154368` spawned child execution `7660942326746841088`; reference row `7660940025885884416`. |
| Upload file and reopen | Verified by live API | Uploaded object key persisted in reopened workflow `7660943337066594304`. |

## Phase 0 final nodeDebug evidence

The final response-sampling action was completed on 2026-07-11 using the dedicated local baseline account. Live `POST /api/workflow_api/nodeDebug` and follow-up `GET /api/workflow_api/get_process` responses were captured for every Mirap node in:

- `testdata/api/workflow/mirap-node-debug-live-samples.json`

The three local MMSI set-operation nodes completed successfully. `MirapAreaShipExtractor`, `MirapStayCalculation`, and `MirapHoverDetail` reached the runtime but failed because the configured host `mirap-test.elane.com` could not be resolved from the local machine. This closes the missing-response evidence gap, but successful external-node execution still depends on restoring DNS/network access to the Mirap test service.
