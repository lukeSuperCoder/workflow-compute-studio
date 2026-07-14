# MMSI Extractor Operator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent “提取 MMSI 集合” workflow operator that extracts, normalizes, stably deduplicates, and comma-joins MMSI values from one or more upstream object arrays.

**Architecture:** Register a dedicated frontend/backend node type `2004` in `operator_logic`. The frontend owns only upstream-array selection and a fixed `mmsis: string` output; a dedicated backend adaptor invokes a server-owned Python template through `infra/coderunner`, so arbitrary code is never persisted or exposed.

**Tech Stack:** React 18, TypeScript, FlowGram workflow forms, Vitest, Go 1.24, Eino workflow nodes, Coze coderunner.

## Global Constraints

- Preserve current staged changes under `frontend/apps/workflow-studio/` and do not include them in feature commits.
- Keep frontend `StandardNodeType` and backend `NodeTypeMetas.ID` exactly aligned at `2004`.
- Keep `WorkflowNodeRegistry.type` and `meta.nodeDTOType` set to the independent extractor type.
- Register the frontend node in `NODES_V2`, registry exports, and enabled-node-types.
- Implement and test `node-test.ts`, DTO submit/init conversion, save/reopen identity, and fixed `mmsis` output.
- Use TDD: each production behavior must be preceded by a failing focused test.

---

### Task 1: Backend node identity and adaptor registration

**Files:**
- Modify: `backend/domain/workflow/entity/node_meta.go`
- Modify: `backend/domain/workflow/entity/node_meta_mirap_test.go`
- Modify: `backend/domain/workflow/internal/canvas/adaptor/to_schema.go`
- Modify: `backend/domain/workflow/internal/canvas/adaptor/to_schema_test.go`
- Modify: `backend/domain/workflow/entity/vo/canvas.go`
- Create: `backend/domain/workflow/internal/nodes/mirapmmsiextractor/mmsi_extractor.go`

**Interfaces:**
- Consumes: `vo.Node.Data.Inputs.InputParameters`, `convert.SetInputsForNodeSchema`, `convert.SetOutputTypesForNodeSchema`.
- Produces: `entity.NodeTypeMirapMMSIExtractor`, node ID `2004`, and `mirapmmsiextractor.Config` registered as a `nodes.NodeAdaptor`.

- [ ] **Step 1: Write failing metadata and registration tests**

Add assertions equivalent to:

```go
meta := NodeTypeMetas[NodeTypeMirapMMSIExtractor]
assert.Equal(t, int64(2004), meta.ID)
assert.Equal(t, "operator_logic", meta.Category)
assert.True(t, ValidNodeType[NodeTypeMirapMMSIExtractor])
```

and assert `allNodeAdaptorEntries()` contains the extractor type with a non-nil factory.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd backend && go test ./domain/workflow/entity ./domain/workflow/internal/canvas/adaptor -run 'Test.*MirapMMSIExtractor' -count=1`

Expected: compile/test failure because `NodeTypeMirapMMSIExtractor` and its adaptor do not exist.

- [ ] **Step 3: Add minimal identity and Config adaptor**

Add the new constant/meta/valid type and register a factory returning `&mirapmmsiextractor.Config{}`. The config must build this schema:

```go
ns := &schema.NodeSchema{
    Key: vo.NodeKey(n.ID),
    Type: entity.NodeTypeMirapMMSIExtractor,
    Name: n.Data.Meta.Title,
    Configs: c,
}
```

Then call `convert.SetInputsForNodeSchema` and `convert.SetOutputTypesForNodeSchema`. Add an optional extractor config slot to `vo.Inputs` only if persisted extractor-specific fields are required; do not persist executable code.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `cd backend && go test ./domain/workflow/entity ./domain/workflow/internal/canvas/adaptor -run 'Test.*MirapMMSIExtractor' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit only Task 1 files**

```bash
git add backend/domain/workflow/entity/node_meta.go backend/domain/workflow/entity/node_meta_mirap_test.go backend/domain/workflow/entity/vo/canvas.go backend/domain/workflow/internal/canvas/adaptor/to_schema.go backend/domain/workflow/internal/canvas/adaptor/to_schema_test.go backend/domain/workflow/internal/nodes/mirapmmsiextractor/mmsi_extractor.go
git commit -m "feat(workflow): register MMSI extractor operator"
```

### Task 2: Fixed coderunner execution and extraction semantics

**Files:**
- Modify: `backend/domain/workflow/internal/nodes/mirapmmsiextractor/mmsi_extractor.go`
- Create: `backend/domain/workflow/internal/nodes/mirapmmsiextractor/mmsi_extractor_test.go`

**Interfaces:**
- Consumes: `coderunner.GetCodeRunner().Run(ctx, &coderunner.RunRequest{Code, Params, coderunner.Python})`.
- Produces: `Runner.Invoke(context.Context, map[string]any) (map[string]any, error)` returning exactly `map[string]any{"mmsis": string}`.

- [ ] **Step 1: Write failing runner tests with a recording fake coderunner**

Cover this table:

```go
{
  name: "stable merge and deduplicate",
  input: map[string]any{
    "dataset_1": []any{map[string]any{"mmsi": 2}, map[string]any{"mmsi": " 1 "}},
    "dataset_2": []any{map[string]any{"mmsi": "1"}, map[string]any{"mmsi": 3}},
  },
  want: "2,1,3",
}
```

Also cover empty/all-invalid input, `"00123"` versus `123`, non-array dataset errors, nil coderunner, coderunner errors, and malformed coderunner responses.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd backend && go test ./domain/workflow/internal/nodes/mirapmmsiextractor -count=1`

Expected: FAIL because Build/Invoke and the fixed template behavior are incomplete.

- [ ] **Step 3: Implement the fixed Python template and runner validation**

Use a server-side constant with this behavior:

```python
async def main(args):
    seen = set()
    values = []
    for name in sorted(args.params.keys(), key=lambda value: int(value.split('_')[-1])):
        dataset = args.params[name]
        if not isinstance(dataset, list):
            raise TypeError(f"{name} must be an array")
        for item in dataset:
            if not isinstance(item, dict):
                continue
            value = item.get("mmsi")
            if isinstance(value, bool) or not isinstance(value, (str, int, float)):
                continue
            normalized = str(value).strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            values.append(normalized)
    return {"mmsis": ",".join(values)}
```

Before invoking Python, validate dataset keys in the runtime input are ordered from the schema/config rather than relying on Go map order. Reject missing/nil coderunner and malformed/non-string `mmsis` results with contextual errors.

- [ ] **Step 4: Run focused and neighboring backend tests**

Run: `cd backend && go test ./domain/workflow/internal/nodes/mirapmmsiextractor ./domain/workflow/internal/nodes/mirapmmsiset -count=1`

Expected: PASS.

- [ ] **Step 5: Commit only Task 2 files**

```bash
git add backend/domain/workflow/internal/nodes/mirapmmsiextractor
git commit -m "feat(workflow): execute fixed MMSI extraction code"
```

### Task 3: Frontend registry, form transformer, and node test

**Files:**
- Modify: `frontend/packages/workflow/base/src/types/node-type.ts`
- Modify: `frontend/packages/workflow/adapter/base/src/utils/get-enabled-node-types.ts`
- Modify: `frontend/packages/workflow/playground/src/node-registries/index.ts`
- Modify: `frontend/packages/workflow/playground/src/nodes-v2/constants.ts`
- Modify: `frontend/packages/workflow/playground/src/node-registries/__tests__/mirap-node-registries.test.ts`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/constants.ts`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/types.ts`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/data-transformer.ts`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/form.tsx`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/form-meta.tsx`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/node-content.tsx`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/node-registry.ts`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/node-test.ts`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/index.ts`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/__tests__/data-transformer.test.ts`
- Create: `frontend/packages/workflow/playground/src/node-registries/mirap-mmsi-extractor/__tests__/node-test.test.ts`

**Interfaces:**
- Consumes: `InputValueVO[]`, `nodeUtils.refExpressionToValueDTO`, variable-service facade fallback, `InputsField`, and `generateParametersToProperties`.
- Produces: registry type/DTO type `StandardNodeType.MirapMMSIExtractor`, `inputs.inputParameters` named `dataset_N`, and fixed `outputs = [{name: 'mmsis', type: ViewVariableType.String}]`.

- [ ] **Step 1: Query modern frontend guidance before editing client code**

Use the repository-mandated `modern-web-guidance` skill for React form/state and accessibility guidance, then keep the existing node form patterns.

- [ ] **Step 2: Write failing registry and transformer tests**

Assert:

```ts
expect(StandardNodeType.MirapMMSIExtractor).toBe('2004');
expect(MIRAP_MMSI_EXTRACTOR_NODE_REGISTRY.meta.nodeDTOType).toBe('2004');
expect(submitted.inputs.inputParameters).toHaveLength(2);
expect(submitted.inputs.inputParameters.map(item => item.name)).toEqual([
  'dataset_1',
  'dataset_2',
]);
expect(submitted.outputs[0]).toMatchObject({
  name: 'mmsis',
  type: ViewVariableType.String,
});
```

Cover normal ref conversion, variable-facade fallback, init restoration, zero-input validation, and generation of both node-test properties.

- [ ] **Step 3: Run frontend tests and verify RED**

Run: `cd frontend/packages/workflow/playground && rushx test -- src/node-registries/__tests__/mirap-node-registries.test.ts src/node-registries/mirap-mmsi-extractor/__tests__`

Expected: FAIL because the extractor module and enum do not exist.

- [ ] **Step 4: Implement the minimal frontend node**

Reuse the existing MMSI set node’s array-object-only `InputsField` behavior and DTO fallback, but omit output-field groups and main-input controls. Normalize names by array order:

```ts
const normalized = (value.inputs?.inputParameters ?? []).map((item, index) => ({
  ...item,
  name: `dataset_${index + 1}`,
}));
```

The registry must expose `inputParametersPath: 'inputs.inputParameters'`, `variablesMeta`, fixed outputs, and `test`. The form validator must require at least one array-object reference.

- [ ] **Step 5: Run frontend focused tests and type/lint checks**

Run: `cd frontend/packages/workflow/playground && rushx test -- src/node-registries/__tests__/mirap-node-registries.test.ts src/node-registries/mirap-mmsi-extractor/__tests__`

Run: `cd frontend/packages/workflow/playground && rushx lint`

Expected: PASS with no new warnings.

- [ ] **Step 6: Commit only Task 3 files**

```bash
git add frontend/packages/workflow/base/src/types/node-type.ts frontend/packages/workflow/adapter/base/src/utils/get-enabled-node-types.ts frontend/packages/workflow/playground/src/node-registries frontend/packages/workflow/playground/src/nodes-v2/constants.ts
git commit -m "feat(workflow): add MMSI extractor node UI"
```

### Task 4: Cross-layer verification and save/reopen evidence

**Files:**
- Modify if necessary: files from Tasks 1–3 only
- Create: `testdata/api/workflow/mirap-mmsi-extractor-sample.json` only if an existing fixture convention requires it

**Interfaces:**
- Consumes: saved canvas JSON and live/simulated node-debug APIs.
- Produces: evidence that type `2004`, input mappings, fixed output schema, and execution survive save/reopen.

- [ ] **Step 1: Run the complete focused regression suite**

```bash
cd backend && go test ./domain/workflow/entity ./domain/workflow/internal/canvas/adaptor ./domain/workflow/internal/nodes/mirapmmsiextractor ./domain/workflow/internal/nodes/mirapmmsiset -count=1
cd frontend/packages/workflow/playground && rushx test -- src/node-registries/__tests__/mirap-node-registries.test.ts src/node-registries/mirap-mmsi-set/__tests__ src/node-registries/mirap-mmsi-extractor/__tests__
```

Expected: PASS.

- [ ] **Step 2: Inspect save schema**

Confirm the serialized node contains:

```json
{
  "type": "2004",
  "inputs": {
    "inputParameters": [
      {"name": "dataset_1", "input": {"value": {"content": {"blockID": "...", "name": "..."}}}}
    ]
  },
  "outputs": [{"name": "mmsis", "type": "string"}]
}
```

- [ ] **Step 3: Verify reopen and single-node execution**

Open or simulate a workflow with two upstream arrays, save, reopen, and run the extractor. Confirm the node title remains “提取 MMSI 集合”, both references remain selected, and `[2,1] + [1,3]` yields `{"mmsis":"2,1,3"}`.

- [ ] **Step 4: Run final hygiene checks**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors; pre-existing staged `frontend/apps/workflow-studio/` files remain untouched.

- [ ] **Step 5: Commit any verification-only fixture/fix**

Stage only the extractor files reported by `git status --short`, then commit them with:

```bash
git commit -m "test(workflow): verify MMSI extractor lifecycle"
```
