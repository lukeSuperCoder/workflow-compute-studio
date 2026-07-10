# Workflow API baseline samples

`core-api-samples.json` records normalized request and response examples for the workflow APIs that must remain compatible during the Mirap Workflow Studio extraction.

The examples are deliberately safe to commit:

- placeholder IDs are used;
- secrets, session keys, cookies, and authorization headers are omitted;
- response payloads are reduced to fields needed for compatibility checks;
- full canvas schema is referenced from `testdata/workflows/mirap-all-nodes.canvas.json`.

These samples are not a substitute for live phase 0 verification. They provide stable request/response shapes for migration tests and documentation.

The file also includes observed live IDs for the all-Mirap save/publish flow, subworkflow run, and upload/reopen flow. Session cookies and uploaded file contents are intentionally not included.

`mirap-node-debug-live-samples.json` contains the 2026-07-11 live `nodeDebug` and `get_process` evidence for all six Mirap node types. The three in-process MMSI set nodes completed successfully. The three HTTP-backed nodes returned real execution records but failed because `mirap-test.elane.com` was not resolvable from the local host; this environmental failure is retained rather than replaced with a synthetic success response.
