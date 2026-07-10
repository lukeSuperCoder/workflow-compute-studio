# MMSI 集合运算工作流节点设计

> 日期：2026-07-09
> 状态：设计讨论稿
> 适用范围：Coze Studio 工作流「算子」类目下的集合运算节点
> 关联文档：`docs/custom-workflow-nodes-feasibility.md`

## 1. 背景与目标

本设计用于新增三个封装型集合运算工作流节点：MMSI 交集、MMSI 并集、MMSI 差集。节点面向多个上游接口或算子返回的船舶结果集，按固定业务主键 `mmsi` 进行记录级关联和筛选。

节点底层可以理解为“封装代码节点”或“独立后端 NodeType 的进程内 runner”，但对用户不暴露代码编辑器，也不要求用户理解 join key。用户在节点面板中直接选择交集、并集或差集节点，配置页内部不再展示运算类型，只需要选择参与运算的结果集和最终输出字段。

核心目标：

- 固定关联 key 为 `mmsi`，不在配置面板展示。
- 交集、并集、差集拆成三个独立节点，节点名称即代表运算类型。
- 交集和并集按 join 语义合并多个结果集字段。
- 差集按主结果集做排除，不做右侧字段合并。
- 输出仍采用“单个数组结果 + 元素字段勾选”的模式，便于下游节点引用。
- 候选字段只来自前序节点已经勾选并暴露的输出字段；上游未勾选字段在本节点不可见、不可选、不可输出。
- 配置页按前序结果集分组展示字段，运行时仍合并为一个扁平 JSON 对象数组。

## 2. 基本数据模型

### 2.1 输入结果集

每个输入必须是对象数组，数组元素代表一条船舶记录：

```json
[
  {
    "mmsi": "371836000",
    "enName": "MOL ENDOWMENT",
    "shipType": "集装箱船"
  }
]
```

第一版要求：

- 输入字段类型必须是数组，元素必须是对象。
- 每条记录的 `mmsi` 必须是顶层字段。
- 不支持嵌套路径作为关联 key，例如 `ship.mmsi`。
- `mmsi` 允许字符串或数字，运行时统一转成字符串比较。
- 缺少 `mmsi` 或 `mmsi` 为空的记录不参与集合运算。

### 2.2 输出结果集

节点输出一个对象数组，例如 `result`：

```json
{
  "result": [
    {
      "mmsi": "371836000",
      "enName": "MOL ENDOWMENT",
      "shipType": "集装箱船"
    }
  ]
}
```

建议固定：

- 输出变量名第一版固定为 `result`，减少配置项。
- `result` 元素字段由用户按前序结果集分组勾选。
- `mmsi` 默认勾选且不可取消，保证下游仍有稳定船舶标识。
- 字段分组只用于配置页展示和来源选择；最终输出对象不按来源嵌套。

## 3. 运算语义

### 3.1 交集运算

交集等价于按 `mmsi` 对多个结果集做 `inner join`。

规则：

- 不需要选择主结果集。
- 只保留所有输入结果集中都存在的 `mmsi`。
- 对命中的同一 `mmsi`，合并多个输入结果集的字段。
- 输出字段由用户从已选输入结果集已经暴露的候选字段中勾选。

示例：

```json
{
  "A": [
    { "mmsi": "1", "name": "船A" },
    { "mmsi": "2", "name": "船B" }
  ],
  "B": [
    { "mmsi": "2", "speed": 12 },
    { "mmsi": "3", "speed": 15 }
  ]
}
```

交集结果：

```json
[
  { "mmsi": "2", "name": "船B", "speed": 12 }
]
```

### 3.2 并集运算

并集等价于按 `mmsi` 对多个结果集做 `full outer join`。

规则：

- 不需要选择主结果集。
- 保留任一输入结果集中出现过的 `mmsi`。
- 对同一 `mmsi`，合并多个输入结果集的字段。
- 输出字段由用户从已选输入结果集已经暴露的候选字段中勾选。
- 某条记录缺少已勾选字段时，输出值补 `null`。

示例：

```json
{
  "A": [
    { "mmsi": "1", "name": "船A" },
    { "mmsi": "2", "name": "船B" }
  ],
  "B": [
    { "mmsi": "2", "speed": 12 },
    { "mmsi": "3", "speed": 15 }
  ]
}
```

并集结果：

```json
[
  { "mmsi": "1", "name": "船A", "speed": null },
  { "mmsi": "2", "name": "船B", "speed": 12 },
  { "mmsi": "3", "name": null, "speed": 15 }
]
```

### 3.3 差集运算

差集等价于按 `mmsi` 做 `left anti join`。

规则：

- 必须选择主结果集。
- 结果为“主结果集中存在，但其他结果集中不存在”的记录。
- 右侧结果集只用于排除，不参与字段合并。
- 输出字段建议只允许从主结果集字段中选择。

示例：

```json
{
  "A": [
    { "mmsi": "1", "name": "船A" },
    { "mmsi": "2", "name": "船B" },
    { "mmsi": "3", "name": "船C" }
  ],
  "B": [
    { "mmsi": "2", "speed": 12 }
  ]
}
```

差集 `A - B` 结果：

```json
[
  { "mmsi": "1", "name": "船A" },
  { "mmsi": "3", "name": "船C" }
]
```

## 4. 配置面板设计

配置面板不展示关联 key，`mmsi` 是节点内置规则。交集、并集、差集是三个独立节点，因此配置面板也不展示“运算类型”。

建议字段：

| 配置项 | MMSI 交集节点 | MMSI 并集节点 | MMSI 差集节点 | 说明 |
|---|---:|---:|---:|---|
| 输入结果集 | 是 | 是 | 是 | 多选上游对象数组字段 |
| 主结果集 | 否 | 否 | 是 | 仅差集展示和必填 |
| 输出字段 | 是 | 是 | 是 | 按前序结果集分组勾选最终 `result` 元素字段 |

交互规则：

- 交集、并集至少选择两个输入结果集。
- 差集至少选择一个主结果集和一个对比结果集。
- 交集、并集节点不展示“主结果集”配置项。
- 差集节点固定展示“主结果集”配置项，且只能从已选输入结果集中选择。
- `mmsi` 输出字段默认选中且禁用取消。
- 至少保留一个输出字段；由于 `mmsi` 不可取消，天然满足该约束。

## 5. 字段合并规则

### 5.1 候选字段生成

交集和并集：

- 候选字段来自所有已选输入结果集“已暴露输出字段”的并集。
- 如果某个前序节点的原始接口返回了字段，但该前序节点没有在自身输出字段中勾选该字段，则本集合运算节点不能展示、选择或输出该字段。
- 配置页按输入结果集分组展示字段，例如“区域船舶”“停留事件”分别列出各自已暴露字段。
- 每个分组内 `mmsi` 固定置顶且不可取消；最终输出中只保留一个 `mmsi`。
- 重复字段 key 可以在不同分组中看到来源，但最终扁平 JSON 只输出一个同名 key。

差集：

- 候选字段只展示主结果集“已暴露输出字段”这一组。
- 不展示对比结果集独有字段，避免用户误以为右侧字段会进入输出。
- 同样不展示主结果集原始数据中存在但未被上游节点暴露的字段。

### 5.2 同名字段冲突

同一个 `mmsi` 在多个结果集中命中时，如果存在相同字段 key：

- 配置页允许在不同来源分组中看到同名字段。
- 最终输出对象是扁平 JSON，同名字段只出现一次。
- 第一版按输入结果集选择顺序保留第一个非空值。
- 后续可扩展为“主结果集优先”“后者覆盖”“字段来源手动选择”等策略。

示例：

```json
{
  "A": [{ "mmsi": "1", "name": "船A" }],
  "B": [{ "mmsi": "1", "name": "船A-更新" }]
}
```

若输入顺序为 A、B，则输出：

```json
[
  { "mmsi": "1", "name": "船A" }
]
```

## 6. 重复与异常数据规则

### 6.1 单个结果集内 `mmsi` 重复

第一版建议采用稳定且简单的规则：

- 同一输入结果集内相同 `mmsi` 只保留第一条记录。
- 后续重复记录忽略。

原因：

- 避免 join 后产生多对多结果膨胀。
- 保持输出一船一条记录，符合船舶集合运算的直觉。

后续如果业务确实需要保留多条，可再扩展为聚合策略或冲突提示。

### 6.2 缺失 `mmsi`

运行时处理建议：

- 缺少 `mmsi` 的记录跳过，不参与运算。
- 如果某个输入结果集中所有记录都缺少 `mmsi`，该输入视为空结果集。
- 可在单节点试运行结果或错误提示中展示跳过数量，但第一版不强制。

### 6.3 空输入结果集

规则：

- 交集：任一输入为空，结果为空数组。
- 并集：空输入不影响其他输入的结果。
- 差集：主结果集为空，结果为空数组；对比结果集为空，结果等于主结果集按输出字段投影后的数组。

## 7. 输出字段投影

运算完成后再做字段投影：

1. 先按 `mmsi` 完成交集、并集或差集运算。
2. 再根据用户按来源分组勾选的输出字段生成最终扁平对象。
3. 对于已勾选但当前记录缺失的字段，并集补 `null`；交集和差集可同样补 `null`，保持输出结构稳定。

建议统一补 `null`，这样下游看到的数组元素 schema 更稳定。

## 8. 实现建议

### 8.1 节点形态

生产交付建议走独立 NodeType，而不是前端 preset 壳：

- 保存、重新打开后仍是专属集合运算节点。
- 不依赖代码节点 Python 沙箱可用性。
- 后端可直接在进程内做 map/index/join，性能和错误处理更可控。

若只做交互验证，可临时复用代码节点并生成固定 Python 模板，但需要接受保存后可能退化成普通代码节点的限制。

### 8.2 后端核心算法

三个节点运行时可以复用同一套集合运算函数，但节点类型和配置表单保持独立：

1. 将每个输入结果集转换为 `map[mmsi]record`。
2. MMSI 交集节点：求所有 map 的 key 交集，再按输入顺序合并记录。
3. MMSI 并集节点：求所有 map 的 key 并集，再按输入顺序合并记录。
4. MMSI 差集节点：取主结果集 key，排除其他 map 中出现过的 key。
5. 对最终记录按勾选字段投影。

伪代码：

```text
runIntersection(inputs):
    indexes = inputs.map(indexByMMSI)
    keys = intersect(indexes.keys)
    return project(mergeByInputOrder(keys, indexes))

runUnion(inputs):
    indexes = inputs.map(indexByMMSI)
    keys = union(indexes.keys)
    return project(mergeByInputOrder(keys, indexes))

runDifference(main, others):
    mainIndex = indexByMMSI(main)
    otherIndexes = others.map(indexByMMSI)
    excludedKeys = union(otherIndexes.keys)
    keys = mainIndex.keys - excludedKeys
    return project(mainIndex.records[keys])
```

### 8.3 前端表单重点

前端重点不在暴露复杂逻辑，而在防止无效配置：

- 输入结果集选择器只展示对象数组类型的上游字段。
- 自动从已选结果集的已暴露输出 schema 推导候选输出字段，并按输入结果集分组展示；不能从上游节点的原始接口字段或隐藏字段推导。
- 差集节点校验主结果集是否在已选输入中。
- `mmsi` 字段在输出字段里强制保留。
- 单节点试运行需要能生成多个数组输入的测试表单。

### 8.4 逻辑算子输入映射开发规范

MMSI 交集、并集、差集这类逻辑算子的运行结果高度依赖上游结果集映射。画布连线本身只表达节点拓扑关系，真正进入后端执行图的字段映射来自节点保存态里的 `inputs.inputParameters`。开发新逻辑算子时，不能只验证画布连线、字段勾选或单节点 UI，必须验证保存后的 canvas JSON。

#### 8.4.1 保存态必须包含可执行输入

集合算子的保存态必须满足：

```json
{
  "inputs": {
    "inputParameters": [
      {
        "name": "dataset_1",
        "input": {
          "type": "list",
          "schema": {
            "type": "object",
            "schema": [
              { "name": "mmsi", "type": "integer" }
            ]
          },
          "value": {
            "type": "ref",
            "content": {
              "source": "block-output",
              "blockID": "124132",
              "name": "ships"
            }
          }
        }
      },
      {
        "name": "dataset_2",
        "input": {
          "type": "list",
          "value": {
            "type": "ref",
            "content": {
              "source": "block-output",
              "blockID": "177387",
              "name": "ships"
            }
          }
        }
      }
    ],
    "selectedOutputGroups": [
      { "inputName": "dataset_1", "fields": ["mmsi"] },
      { "inputName": "dataset_2", "fields": ["mmsi"] }
    ]
  }
}
```

其中：

- `dataset_1`、`dataset_2` 是后端 runner 读取运行时输入 map 的 key。
- `input.value.content.blockID/name` 决定运行时从哪个上游节点的哪个输出字段取值。
- `selectedOutputGroups.inputName` 必须与 `inputParameters.name` 一一对应。
- `outputs` 只定义下游可见 schema，不能替代 `inputParameters`。

如果保存后出现以下形态：

```json
{
  "inputs": {
    "inputParameters": [],
    "selectedOutputGroups": [
      { "inputName": "dataset_1", "fields": ["mmsi"] },
      { "inputName": "dataset_2", "fields": ["mmsi"] }
    ]
  }
}
```

后端执行时会拿不到 `dataset_1` 和 `dataset_2`，最终在归一化输入数组时出现类似错误：

```text
Workflow execution failure: got <nil>
```

这个错误表示“运行时输入映射为空”，不是并集/交集/差集算法本身不能处理数组。

#### 8.4.2 前端 transformer 规范

前端 `data-transformer.ts` 必须负责把表单中的引用表达式转换为后端 `ValueExpressionDTO`：

- `formatOnInit`：把后端 DTO 转回表单 VO，保证重新打开后表单能显示上游引用。
- `formatOnSubmit`：把表单 VO 转成后端 DTO，保证保存态有 `inputParameters`。
- 如果使用 `InputsField` 这类数组型输入组件，要专门覆盖数组元素的引用转换，不要只按普通对象型 `inputs.inputParameters` 处理。
- 对 `nodeUtils.refExpressionToValueDTO(...)` 失败的情况要有兜底，优先从 `variableService.getVariableFacadeByKeyPath(...)` 或兼容接口取 `refExpressionDTO`。
- 单测必须覆盖“引用转换失败但 variable facade 可恢复 DTO”的场景，避免保存后静默丢弃输入。

建议至少保留以下断言：

- 选择两个上游对象数组后，`formatOnSubmit` 输出两个 `inputParameters`。
- 每个 `inputParameters[i].input.value.content` 都包含正确的 `blockID` 和输出字段名。
- `selectedOutputGroups` 不为空，且 `inputName` 与 `inputParameters.name` 对齐。

#### 8.4.3 后端 adaptor 兜底规范

逻辑算子后端 `Adapt` 不应完全信任前端保存态。对于以“上游数组结果集”为输入的算子，建议加一层受限兜底：

- 正常情况下优先使用 `n.Data.Inputs.InputParameters`，不改变用户显式选择。
- 仅当 `inputParameters` 为空时，才允许从 `nodes.WithCanvas(c)` 提供的 canvas 入边恢复输入。
- 恢复时按当前节点入边顺序生成 `dataset_1`、`dataset_2` 等输入名；如果配置里已有 `selectedOutputGroups.inputName`，优先沿用配置名。
- 只从上游节点的对象数组/list 输出恢复，MMSI 场景优先选择上游 `ships` 输出。
- 恢复后仍要走 `convert.SetInputsForNodeSchema`，让类型和 `InputSources` 进入统一执行图。

这层兜底是为了兼容历史 draft 或前端保存链路异常，不应替代前端 transformer 的正确保存逻辑。

#### 8.4.4 字段选择与输入集错位风险

集合算子保存态里有两类互相关联的数据：

- `inputs.inputParameters[i].name`：运行时输入 map 的 key，如 `dataset_1`。
- `inputs.selectedOutputGroups[i].inputName`：输出字段选择所属的输入集。

二者不仅要名字存在，还必须保持同一语义来源。若用户重新连线、插入新上游、节点恢复或前端同步异常导致输入顺序变化，就可能出现以下隐蔽错误：

```json
{
  "inputParameters": [
    { "name": "dataset_1", "input": "区域船.ships" },
    { "name": "dataset_2", "input": "低速事件.low_speed_events" },
    { "name": "dataset_3", "input": "折返事件明细.turnback_event_details" }
  ],
  "selectedOutputGroups": [
    { "inputName": "dataset_1", "fields": ["mmsi", "beginTime", "beginLon"] },
    { "inputName": "dataset_2", "fields": ["mmsi"] },
    { "inputName": "dataset_3", "fields": ["mmsi", "enName", "age"] }
  ]
}
```

上例中 `dataset_1` 实际是区域船，却选择了折返字段；`dataset_3` 实际是折返明细，却选择了区域船字段。运行结果可能仍然成功，MMSI 数量也可能正确，但被错配的字段会因为当前记录缺少该 key 而被补成 `null`。这种问题比执行失败更难发现。

修复和防护要求：

- 前端在输入结果集变更、重排、重连、恢复保存态时，必须按当前输入引用重新构建字段分组，避免沿用旧 `dataset_N` 的字段选择。
- `selectedOutputGroups.inputName` 不应只按数组下标复用；它必须与当前 `inputParameters.name` 以及该输入引用的上游输出 schema 一起校验。
- 后端 runner 可以做受限兼容：运行时先扫描每个输入集实际出现的字段；如果某个已选字段在当前输入集中不存在，但在另一个输入集中唯一存在，则把该字段归回实际拥有者后再投影。
- 后端兼容只用于修复历史保存态或前端同步异常，不应替代前端保存态修正；如果多个输入集都拥有同名字段，仍按原配置和输入顺序处理，不能猜测来源。

必须保留回归用例：

- `dataset_1` 实际输入为区域船字段，`selectedOutputGroups.dataset_1` 错选折返字段。
- `dataset_3` 实际输入为折返字段，`selectedOutputGroups.dataset_3` 错选区域船字段。
- 并集执行应保持 MMSI 数量正确，并把 `enName/age` 归回区域船记录，把 `beginTime/beginLon` 归回折返记录。

#### 8.4.5 交集、并集、差集的共享风险

当前三个集合运算节点共用同一个后端实现包和 adaptor：

```text
backend/domain/workflow/internal/nodes/mirapmmsiset/
```

因此输入映射类问题不会只影响并集。只要某个集合算子保存后 `inputParameters` 为空，交集、并集、差集都会在执行时拿不到 `dataset_1`、`dataset_2`，并可能报 `got <nil>`。

差集还额外依赖 `mainInputName`：

- `inputParameters` 为空会导致运行时输入缺失。
- `mainInputName` 为空会导致差集无法判断主结果集，应返回明确错误。
- 差集测试要同时覆盖“输入映射存在”和“主结果集配置存在”。

#### 8.4.6 回归验证清单

开发或修改新逻辑算子时，至少验证以下路径：

- 前端 transformer 单测：`formatOnSubmit` 能保留多个上游引用。
- 后端 adaptor 单测：当 `inputParameters` 为空但 canvas 存在入边时，可以从上游对象数组输出恢复 `InputTypes` 和 `InputSources`。
- 后端 runner 单测：交集、并集、差集分别覆盖正常输入、空输入、缺失 `mmsi`、重复 `mmsi`、字段投影、字段选择与输入集错位。
- 保存态检查：在 `workflow_draft.canvas` 或保存请求 payload 中确认目标节点 `inputs.inputParameters` 非空。
- 保存态检查：确认 `selectedOutputGroups.inputName` 与当前 `inputParameters.name` 和上游输出 schema 语义一致，不只是数组长度一致。
- 运行态检查：实际流程运行不再出现 `Workflow execution failure: got <nil>`。
- 运行态检查：并集/交集结果中被勾选字段不应在对应上游有值时全部变成 `null`。

## 9. 第一版明确不做

为控制复杂度，第一版不做以下能力：

- 不支持用户选择关联 key。
- 不支持字段路径映射，例如 `A.mmsi` 对 `B.ship_mmsi`。
- 不支持嵌套字段展开或深度合并。
- 不支持多对多 join 输出。
- 不支持同名字段来源手动选择。
- 不支持可配置冲突策略。
- 不支持输出多个数组变量。

这些能力可以作为后续增强，但不影响第一版业务闭环。

## 10. 当前推荐结论

当前设计建议定为：

- 三个独立集合运算节点：MMSI 交集、MMSI 并集、MMSI 差集。
- 关联 key 固定为 `mmsi`，不展示在配置面板。
- 交集和并集不需要主结果集，按 `mmsi` 分别做 `inner join` 和 `full outer join`。
- 差集必须选择主结果集，按 `mmsi` 做 `left anti join`。
- 输出固定为 `result` 对象数组，`mmsi` 必选，其他字段由用户按来源分组勾选。
- 字段冲突第一版按输入选择顺序保留第一个非空值。
- 同一结果集内重复 `mmsi` 第一版保留第一条。
- 开发验收必须检查保存后的 `inputs.inputParameters` 和后端 `InputSources`，不能只看画布连线和字段勾选是否正常。

这套规则能覆盖当前“多个接口结果按船舶 MMSI 做合并、取交、取并、排除”的业务需求，同时保持节点配置足够简单。
