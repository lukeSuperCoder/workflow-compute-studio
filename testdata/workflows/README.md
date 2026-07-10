# Workflow fixtures

These fixtures are phase 0 compatibility data for extracting Mirap Workflow Studio from the full Coze Studio repository.

## Files

- `mirap-all-nodes.canvas.json`
  - A sanitized canvas schema containing Start, End, and all six Mirap node types.
  - Based on the observed `node_calc_01` schema shape from the old repository.
  - MinIO signed URLs were replaced by stable object keys.

- `node-whitelist.json`
  - Candidate node whitelist for the workflow-only extraction.
  - This is a baseline decision record, not runtime enforcement yet.

## Notes

- IDs are stable fixture IDs, not production IDs.
- The all-node canvas is for schema compatibility and save/reopen validation.
- Live old-repo validation now includes `nodeDebug` responses for all six Mirap node types, subworkflow reference/run, and upload/reopen evidence; see `docs/mirap-workflow-behavior-baseline.md`. The HTTP-backed node samples retain their observed DNS failure because the configured Mirap test host was not resolvable during capture.
