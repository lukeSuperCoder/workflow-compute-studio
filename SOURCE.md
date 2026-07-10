# Source and extraction baseline

This repository starts from a full source snapshot of [Coze Studio](https://github.com/coze-dev/coze-studio) and is being reduced into Workflow Compute Studio according to `docs/mirap-workflow-extraction-plan.md`.

## Baseline

- Upstream project: `coze-dev/coze-studio`
- Local source repository: `lukeSuperCoder/coze-studio-compute`
- Source commit before extraction fixtures: `370eb2802966d331618dba3a7905b811c43ef3ac`
- Extraction baseline captured: 2026-07-11
- License: Apache License 2.0; existing copyright and license headers are retained

The phase 0 behavior baseline, API samples, database samples, canvas fixtures, and node whitelist are stored under `docs/` and `testdata/`. Stage 1 intentionally keeps the complete source tree; unrelated modules are removed only in later, separately verifiable stages.

## Compatibility boundary

The initial extraction preserves the existing workflow API paths, persisted canvas schema, node type identifiers, save/reopen behavior, publish behavior, workflow execution behavior, and single-node debug behavior. The candidate runtime node boundary is recorded in `testdata/workflows/node-whitelist.json`.

See `LICENSE` for the full license text.
