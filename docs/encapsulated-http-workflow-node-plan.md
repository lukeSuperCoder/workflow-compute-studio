# 封装型 HTTP 工作流算子技术方案

> 日期：2026-07-10  
> 状态：通用开发规范  
> 适用范围：Coze Studio 工作流「算子」类目中，HTTP 请求细节固定、仅向用户暴露业务参数的节点。

## 1. 目标与边界

封装型 HTTP 算子用于把一个稳定的外部接口包装成独立工作流节点。节点运行时仍调用 HTTP 服务，但 URL、Method、鉴权和请求体映射由实现固定；用户只配置业务输入和使用业务输出。

本方案的目标是让后续新增接口算子时，输出建模以**真实接口契约**为准，不能通过复制既有节点的 UI 或配置来假设输出是“船舶对象数组”。

每个算子必须明确以下契约：

| 契约 | 必须明确的内容 |
|---|---|
| 输入 | 工作流变量名、类型、必填性、校验和到 HTTP 请求字段的映射 |
| 请求 | URL、Method、必要 Header、鉴权来源、超时、重试策略 |
| 响应 | 成功判定、业务错误字段、实际业务数据路径、字段类型 |
| 输出 | 工作流输出变量名、类型、是否可选字段、运行时值结构 |
| 兼容性 | 旧节点输入/输出名称的迁移或兼容策略 |

不适用本方案的情况：接口地址、方法、鉴权或请求结构需要由用户自由编辑时，应使用通用 HTTP 节点；可由插件声明完成的固定 API，优先评估插件节点。

## 2. 设计原则

1. **先实测接口，后设计节点（强制）**：用户提供接口调用示例后，开发者必须先用该示例实际调用接口，记录真实成功响应、失败响应及字段类型；只有在调用受网络、鉴权或环境限制而无法完成时，才能明确记录原因并请用户提供真实响应。禁止仅根据接口名称、文档或其他节点的字段推断输出。
2. **最小准确输出**：只暴露下游确实需要且能被稳定声明的业务数据；不默认暴露原始响应、状态码、错误文案或其他调试字段。
3. **输出形状必须一致**：前端 `outputs` 声明、后端 `NodeSchema` 输出类型、`Invoke` 返回值三者必须逐层一致。
4. **配置只在有语义时存在**：字段勾选、排序、分页等配置只在对应接口和产品需求真实存在时新增；不得复制其他节点的独占配置结构体。
5. **单一事实来源**：同一配置或字段集合在各层只能有一个来源，并由其派生展示、类型和运行时值。
6. **持久化可恢复**：保存、重开、复制、发布后，节点仍应恢复为专属算子形态及同一业务契约。
7. **鉴权不下发**：token、密码、Cookie 等仅由后端环境变量或受控凭据服务读取，不写入前端和工作流 schema。
8. **必选输出配置化**：如果下游依赖稳定标识（如 `mmsi`），必须在节点常量中声明 `REQUIRED_OUTPUT_FIELDS`；前端展示、保存转换和后端运行时都必须强制包含这些字段，不能只依赖默认勾选值。
9. **必选字段 UI 一致性**：所有封装 HTTP 算子对必选输出字段都使用统一的“已勾选、不可取消”复选框样式，既说明字段存在，也明确它不是用户可配置项。

## 3. 输出建模决策

新增节点前必须为每个接口选择一种输出模式；不能默认使用 `ships: ArrayObject` 或字段勾选模式。

| 响应业务数据 | 推荐工作流输出 | 运行时返回示例 | 是否需要字段勾选 |
|---|---|---|---|
| 标量 | 一个标量变量 | `{"matched": true}` | 否 |
| 需要下游按字段引用的记录列表（即使当前仅有 `mmsi`） | `ArrayObject`，声明真实元素字段 | `{"low_speed_events": []any{map[string]any{"mmsi": int64(1)}}}` | 否 |
| 固定对象 | 一个 `Object` | `{"summary": map[string]any{...}}` | 否 |
| 固定对象列表 | `ArrayObject`，元素属性全量固定 | `{"records": []any{map[string]any{...}}}` | 通常否 |
| 大对象列表，且产品明确允许用户控制下游字段 | `ArrayObject` + 受控字段选择 | 仅返回已选属性 | 是 |
| 不稳定/动态 JSON | 不直接包装为业务算子；先定义稳定 DTO 或使用通用 HTTP 节点 | — | 不适用 |

### 3.1 字段选择模式的使用条件

字段选择不是通用模板，只能同时满足以下条件时使用：

- 接口返回的是对象数组；
- 元素候选字段固定、类型稳定；
- 产品明确需要用户裁剪字段；
- 前端展示、后端类型声明和运行时过滤都能由同一个选择集合派生。

例如“网格提取区域船”返回完整船舶对象，可使用 `inputs.selectedOutputs`。低速事件接口当前真实返回的记录只有 `mmsi`，应声明为 `low_speed_events: ArrayObject`，元素仅有 `mmsi: Integer`，从而让下游直接引用该字段；不应复制区域船节点的字段勾选或 `MirapAreaShip` 配置。

### 3.2 字段选择模式的实现契约

仅在采用该模式时，按以下契约实现：

```text
inputs.selectedOutputs
        ├── 前端 createOutputs(selected) → outputs.children
        ├── 后端 outputType(selected)    → Object.Properties
        └── 后端 Invoke(selected)        → map 中实际保留的字段
```

- 前端候选字段和后端候选字段必须同名、同序、同类型。
- 必选字段（如 `mmsi`）通过 `REQUIRED_OUTPUT_FIELDS` 配置：前端不可取消、保存时自动补回、后端对手工或历史 schema 也必须补回。
- 空选项的语义必须明确：推荐前端阻止“全不选”，并仅为历史 schema 定义兼容回退行为。
- 每个节点都必须有自己的 canvas 独占配置结构体；不能读取另一个算子的配置。

### 3.3 必选输出字段的配置与 UI 规范

当接口记录中的稳定标识需要保证供下游使用（当前两个船舶相关 HTTP 算子的 `mmsi` 即为此类字段）时，按以下规则实现：

1. 在前端 `constants.ts` 用 `REQUIRED_OUTPUT_FIELDS = ['mmsi']` 声明必选字段；禁止只将它写入初始默认值。
2. 若节点存在字段勾选配置，`createOutputs`、`transformOnInit` 与 `transformOnSubmit` 都必须基于该配置规范化选择集合，并自动补回必选字段。
3. 后端必须有同等的必选字段集合，并在输出类型声明和运行时响应转换前补回该字段，防止旧 workflow 或手工 schema 绕过前端约束。
4. 对固定输出节点，同样保留 `REQUIRED_OUTPUT_FIELDS` 声明，即使当前只有一个 `mmsi` 字段；这样新增可选字段时无需改变必选字段契约。
5. 输出 UI 必须与可选字段列表保持一致的层级、间距和类型标签：必选字段渲染 `Checkbox checked disabled`，并显示字段名和类型；不得只用普通文本替代。

该规则同时保证三件事：画布和下游变量可见 `mmsi`、用户不能移除 `mmsi`、运行时结果一定包含 `mmsi`。

## 4. 前后端实现结构

### 4.1 后端

每个新算子必须完成：

1. 在 `backend/domain/workflow/entity/node_meta.go` 新增唯一 `NodeType` 和 `NodeTypeMetas` 条目，类别为 `operator`。
2. 在 `backend/domain/workflow/internal/canvas/adaptor/to_schema.go` 注册专属 adaptor。
3. 在 `backend/domain/workflow/internal/nodes/<operator>/` 实现 `Config.Adapt`、`Config.Build` 与运行节点。
4. 若有专属持久化配置，在 `backend/domain/workflow/entity/vo/canvas.go` 增加**该节点专属**的结构体并嵌入 `Inputs`；无专属配置则不要增加空结构体。

`Adapt` 的责任：调用 `convert.SetInputsForNodeSchema`，从真实契约设置输出类型，读取本节点配置。`Invoke` 的责任：构造固定请求、处理 HTTP 和业务错误、把响应 DTO 转成与 `NodeSchema` 完全一致的 `map[string]any`。

外部服务地址应将环境相关的域名与固定接口路径分离：所有 MIRAP HTTP 算子统一从 `MIRAP_BASE_URL` 读取 Base URL（默认 `https://mirap-test.elane.com`），再拼接各自固定接口路径。Base URL 可包含或不包含末尾 `/`；不得将环境域名硬编码在节点路径常量或完整 endpoint 变量中。

每个 HTTP 算子必须遵守同一套 endpoint 规则：

1. 后端只保留固定 `endpointPath`，如 `/api/.../getMmsiByLowVelocity`；环境域名统一由 `MIRAP_BASE_URL` 提供。
2. 拼接前使用 `strings.TrimRight(baseURL, "/")` 处理末尾斜杠，保证 env 中写 `https://mirap-test.elane.com/` 或 `https://mirap-test.elane.com` 都得到同一个最终地址。
3. `.env.debug.example` 等环境样例必须声明 `MIRAP_BASE_URL`，本地调试环境按需覆盖该值。
4. 后端单测必须覆盖“读取 env 覆盖 Base URL”和“env 为空时使用默认 Base URL”两种场景。

示例：接口 `datas: [{"mmsi": 123}]` 需要让下游引用 `mmsi` 时：

```go
ns.SetOutputType("low_speed_events", &vo.TypeInfo{
    Type: vo.DataTypeArray,
    ElemTypeInfo: &vo.TypeInfo{
        Type: vo.DataTypeObject,
        Properties: map[string]*vo.TypeInfo{
            "mmsi": {Type: vo.DataTypeInteger},
        },
    },
})

return map[string]any{
    "low_speed_events": []any{map[string]any{"mmsi": int64(123)}},
}, nil
```

输出对象应只包含实测响应中声明给工作流的字段；当前仅有 `mmsi` 时，不得凭空增加船名、船型等属性。

### 4.2 前端

节点目录位于 `frontend/packages/workflow/playground/src/node-registries/<operator>/`，至少包含：

| 文件 | 职责 |
|---|---|
| `constants.ts` | 业务输入字段、固定输出名称和类型；仅在需要时定义可选字段集合 |
| `types.ts` | 表单数据和该节点专属配置类型 |
| `data-transformer.ts` | DTO 与表单数据转换、默认值、旧 schema 迁移 |
| `form.tsx` | 只展示用户可配置的业务字段 |
| `form-meta.tsx` | 校验、输出变量 effect、init/submit 转换 |
| `node-registry.ts` / `node-test.ts` | registry 与单节点试运行输入生成 |

并在 `node-registries/index.ts`、`nodes-v2/constants.ts`、`get-enabled-node-types.ts` 注册。前端 `StandardNodeType` 必须与后端 `NodeTypeMetas.ID` 一致；`nodeDTOType` 必须指向该真实节点类型。

`transformOnSubmit` 必须生成与后端 VO 相符的数据；不要为了沿用旧节点而写入无效的 `selectedOutputs`、`ships` 或其他无关字段。

## 5. 命名规则

- 节点显示名：面向业务动作，如“低速事件筛选”，不使用实现细节或误导性名称。
- 输入变量：使用语义明确的 `snake_case`，如 `area_points`、`start_date`、`end_date`，而不是接口内部缩写或无上下文的通用名。
- 输出变量：命名应包含数据含义和集合语义，如 `low_speed_events`；对象数组的元素字段必须使用响应中的真实字段名，如 `mmsi`。
- HTTP 请求字段：可保留上游接口原名，如请求体中的 `startdate`，但通过后端映射与工作流变量名隔离。
- 内部 NodeType 和目录名可保持稳定，显示名或工作流变量改动不应无故改变持久化节点类型 ID。

## 6. 兼容性与迁移

修改已有算子的输入变量或输出契约前，必须评估已保存工作流：

- 输入改名：`transformOnInit` 将旧字段值迁移到新字段；后端 `Invoke` 在过渡期可接受旧键作为 fallback。
- 输出改名/类型改变：这是下游引用的破坏性变更。需要迁移工作流中引用该输出的节点，或保留旧输出并明确弃用周期；不能只改节点表单。
- 删除无效配置：`transformOnInit`/`transformOnSubmit` 需清理旧 schema 中的无关字段，避免重新保存后继续污染节点数据。
- 任何迁移都必须验证“保存后重新打开”和包含下游引用的完整工作流运行。

## 7. 测试与验收清单

### 后端单测

- 使用用户提供的调用示例实测接口，并把脱敏后的真实成功/失败响应样例或其字段清单写入节点设计记录；不能实测时必须记录阻塞原因。
- 固定请求的方法、路径、Header、请求体映射正确。
- 2xx 以外、业务失败码、响应 JSON 非法、鉴权缺失均返回可读错误。
- 每个输出字段的 Go 值类型与 `NodeSchema` 类型一致。
- 空结果返回正确的空数组/空对象，不返回错误形状。
- 若存在字段选择：覆盖全选、子集、未知字段、空值兼容和输出类型同步。
- 若做变量迁移：覆盖新键和旧键输入。

### 前端验证

- 节点出现在「算子」类目，拖入后显示正确名称和默认 I/O。
- 单节点试运行能生成全部必填业务输入。
- 保存并重开后，表单、输出变量和专属配置保持一致。
- 下游变量面板只显示真实声明的输出；没有复制来的字段选择、对象属性或无关变量。
- 修改既有节点时，验证含旧输入和下游引用的工作流迁移策略。

### 提交前检查

1. 前端 `StandardNodeType`、后端 `NodeTypeMetas.ID`、registry `nodeDTOType` 对齐。
2. 前端 `outputs`、后端 `SetOutputType`、`Invoke` 返回 map 的键、数组元素形状和类型逐项比对。
3. 专属配置不与其他节点的 VO 或 JSON 路径复用。
4. 运行目标 Go 单测、相关前端 lint/test，并执行保存/重开验证。

## 8. 新增算子开发流程

1. 用户提供接口调用示例后，先实际调用接口；记录真实成功/失败响应、数据路径及字段类型，再写出 I/O 契约表。调用失败时先排查并记录原因，必要时向用户索取可用凭据或真实响应，不能凭空设计输出。
2. 按第 3 节选择输出模式；先决定数据形状，再写 UI。
3. 定义语义化的工作流变量名，并明确接口字段映射。
4. 同步实现后端 NodeType、adaptor、DTO、输出类型和运行逻辑。
5. 实现前端 registry、表单、数据转换和单节点试运行。
6. 仅在满足第 3.1 节条件时实现字段选择模式。
7. 为改名或改契约实现并验证迁移。
8. 通过第 7 节全部检查后再提交。
