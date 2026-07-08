# 自定义工作流节点技术调研与可行性分析

> **文档类型**：技术调研 / 可行性分析
> **日期**：2026-07-08
> **状态**：Draft
> **适用版本**：coze-studio `main`（commit `22275b1c` 附近）
> **相关 Wiki**：[10. 新增工作流节点类型（前端）](https://github.com/coze-dev/coze-studio/wiki/10.-%E6%96%B0%E5%A2%9E%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%8A%82%E7%82%B9%E7%B1%BB%E5%9E%8B%EF%BC%88%E5%89%8D%E7%AB%AF%EF%BC%89)、[11. 新增工作流节点类型（后端）](https://github.com/coze-dev/coze-studio/wiki/11.-%E6%96%B0%E5%A2%9E%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%8A%82%E7%82%B9%E7%B1%BB%E5%9E%8B%EF%BC%88%E5%90%8E%E7%AB%AF%EF%BC%89)、[4. 插件配置](https://github.com/coze-dev/coze-studio/wiki/4.-%E6%8F%92%E4%BB%B6%E9%85%8D%E7%BD%AE)

---

## 1. 背景与目标

在 Coze Studio 二次开发中，希望新增两类"封装型"工作流节点：

### 需求一：封装 HTTP 请求节点
- **底层仍然发起 HTTP 调用**，但**调用地址与传参结构固定**。
- 用户在画布上**只需选择/填写入参字段的内容**，不需要配置 URL、Method、Header 等。
- 输出在**固定的输出字段集合中选取子集**，不自由声明。

### 需求二：集合运算节点（封装代码节点）
- 底层提供**交集 / 并集 / 差集**三种集合运算，运算逻辑（代码）**固化**。
- 用户**只需选择参与运算的输入字段**（两个列表）以及**输出字段**。
- 不向用户暴露代码编辑器。

### 调研要回答的问题
1. Coze Studio 的工作流节点机制是怎样的？新增一个节点需要改哪些地方？
2. 现有 HTTP 请求节点、代码节点的实现结构是什么？
3. 上述两个需求分别有哪些可行方案？难度如何？推荐怎么做？

---

## 2. 名词约定

| 术语 | 含义 |
|---|---|
| 节点类型（Node Type） | 一类节点的注册逻辑，每个类型有唯一 `type`（数字字符串），前后端约定一致 |
| 节点实例 | 节点类型被拖入画布后生成的具体节点 |
| 舞台节点 | 画布上展示的节点卡片（含摘要信息、试运行结果） |
| 节点表单（Form） | 点击节点后侧边抽屉里的配置项面板 |
| Node Registry | 前端节点注册配置对象（`WorkflowNodeRegistry`） |
| FormMeta（`FormMetaV2`） | 节点表单元数据：渲染、校验、副作用、前后端数据转换 |
| NodeAdaptor / NodeBuilder | 后端接口：前者把前端节点 JSON 转为运行态 `NodeSchema`，后者把 `NodeSchema` 实例化为可执行节点 |
| FlowGram | 画布与表单引擎（[bytedance/flowgram.ai](https://flowgram.ai/)），Coze Studio 内嵌为 `@flowgram-adapter/*` 包 |
| Eino | 后端工作流运行时（[cloudwego/eino](https://github.com/cloudwego/eino)），提供 DAG、Lambda、Callback、Branch 等能力 |

---

## 3. 现状调研：Coze Studio 工作流节点机制

### 3.1 节点类型身份与注册体系

一个节点类型在系统里有**三个层面对应的"身份标识"**，必须一致：

| 层面 | 标识 | 示例（HTTP） | 示例（Code） |
|---|---|---|---|
| 前端枚举 | `StandardNodeType`（数字字符串） | `Http = '45'` | `Code = '5'` |
| 后端字符串 Key | `entity.NodeType` | `NodeTypeHTTPRequester = "HTTPRequester"` | `NodeTypeCodeRunner = "CodeRunner"` |
| 后端数字 ID | `NodeTypeMetas[...].ID` | `45` | `5` |

前后端通过 `IDStrToNodeType`（`backend/domain/workflow/entity/node_meta.go:35`）桥接：前端传 `"45"` → 后端扫描 `NodeTypeMetas` 找到 `ID==45` → 得到 `"HTTPRequester"`。

> **结论**：新增节点类型时，前端枚举值与后端 `NodeTypeMetas.ID` **必须严格相等**，否则会出现"画布能拖出节点但运行报错"。

#### 3.1.1 `type` 与 `nodeDTOType` 的持久化边界

前端 registry 里有两个容易混淆的类型字段：

| 字段 | 位置 | 作用 |
|---|---|---|
| `type` | `WorkflowNodeRegistry.type` | FlowGram 画布内识别节点、匹配 registry、渲染表单与节点卡片 |
| `nodeDTOType` | `WorkflowNodeRegistry.meta.nodeDTOType` | 提交保存时写入后端 schema 的 `json.type` |

保存工作流时，`frontend/packages/workflow/nodes/src/workflow-json-format.ts` 会执行：

```ts
json.type = String(nodeDTOType || json.type);
```

这意味着：

1. 如果自定义前端节点的 `nodeDTOType` 指向已有类型（如 `StandardNodeType.Code` 或 `StandardNodeType.Http`），后端可以零改动执行；但保存后的 schema 类型就是普通 Code/Http，重新打开工作流时容易按普通节点 registry 还原，除非额外做"preset 标识"和恢复分流逻辑。
2. 如果自定义前端节点的 `nodeDTOType` 指向新类型，则必须在后端新增对应 `NodeTypeMetas.ID` 和 adaptor，否则后端无法识别。

> **修正结论**："纯前端 preset + 后端零改动"只适合作为快速验证或轻量包装方案；如果要求保存、重新打开、复制、发布后仍保持独立节点形态，应新增后端 NodeType，或明确设计一套基于已有类型的 preset 恢复机制。

### 3.2 前端节点开发模式（FlowGram）

前端节点开发围绕一个 `WorkflowNodeRegistry` 对象展开，核心字段：

```ts
// frontend/packages/workflow/base/src/types/registry.ts:125
interface WorkflowNodeRegistry<NodeTestMeta> {
  type: StandardNodeType;          // 节点类型枚举
  meta: NodeMeta;                  // 画布尺寸、路径、试运行配置等
  formMeta: FormMetaV2<FormData>;  // 表单元数据（核心）
  // ...getNodeInputs / getNodeOutputs / beforeNodeSubmit / onInit / checkError
}
```

每个节点在 `frontend/packages/workflow/playground/src/node-registries/<node>/` 下有标准目录结构：

```
node-registries/<node>/
├── node-registry.ts    // 必选：导出 *_NODE_REGISTRY
├── form-meta.tsx       // 必选：FormMetaV2（render/validate/effect/formatOnInit/formatOnSubmit）
├── form.tsx            // 必选：表单渲染组件
├── data-transformer.ts // 可选：前后端数据互转
├── node-test.ts        // 必选：单节点试运行配置
├── constants.ts        // 可选：常量、固定输入输出定义
├── types.ts            // 必选：表单数据类型
├── node-content.tsx    // 必选：画布卡片
├── components/         // 可选：自定义子组件
└── index.ts            // 必选：入口
```

**关键点：`FormMetaV2` 的 `formatOnSubmit` 是"封装型节点"的核心抓手。** 它负责把前端表单值转换成后端期望的 DTO。对于"固化配置"的需求，可以在这里**替用户把固定字段填好**，只让用户配置少量选项。

所有 registry 在 `frontend/packages/workflow/playground/src/nodes-v2/constants.ts` 的 `NODES_V2` 数组里聚合，最终由 `workflow-nodes-v2-contribution.ts` 注册进 FlowGram 编辑器。另外还需要在 `frontend/packages/workflow/adapter/base/src/utils/get-enabled-node-types.ts` 中把节点加入启用列表，否则 registry 存在也可能不会出现在节点面板。

> 前端有脚手架：`cd packages/workflow/playground && rushx create:node`，可一键生成上述骨架。

### 3.3 后端节点开发模式（Eino + NodeAdaptor / NodeBuilder）

后端一个节点类型由两个结构体 + 一处注册构成（参考 Wiki 11 的 JSON 序列化节点示例）：

```go
// 1) Config 结构体：实现 NodeAdaptor（vo.Node -> NodeSchema）+ NodeBuilder（NodeSchema -> 可执行节点）
type XxxConfig struct {
    // 任意可序列化、导出的字段，存放从前端节点抽取的特定信息
}

func (c *XxxConfig) Adapt(ctx, n *vo.Node, ...) (*schema.NodeSchema, error) {
    ns := &schema.NodeSchema{Key: ..., Type: entity.NodeTypeXxx, Name: ..., Configs: c}
    convert.SetInputsForNodeSchema(n, ns)   // 设置输入字段类型与映射
    convert.SetOutputTypesForNodeSchema(n, ns) // 设置输出字段类型
    return ns, nil
}

func (c *XxxConfig) Build(ctx, ns *schema.NodeSchema, ...) (any, error) {
    return &XxxRunner{...}, nil
}

// 2) 执行体：实现 InvokableNode 等
type XxxRunner struct{}

func (r *XxxRunner) Invoke(ctx, input map[string]any) (map[string]any, error) {
    // 业务逻辑；input/output 都是 map[string]any
}
```

**三处必改：**
1. `backend/domain/workflow/entity/node_meta.go`：加 `NodeTypeXxx` 常量 + `NodeTypeMetas` 条目（含 ID、显示名、分类、图标、`ExecutableMeta` 等）。
2. `backend/domain/workflow/internal/canvas/adaptor/to_schema.go` 的 `RegisterAllNodeAdaptors()`：注册适配器工厂。
3. `backend/domain/workflow/internal/nodes/<node>/`：放 `Config` 与执行体。

可选：`backend/domain/workflow/entity/vo/canvas.go` 的 `Inputs` 结构体加一个类型特定的嵌入字段（如 `*HttpRequestNode`），用于强类型解析前端 JSON。

**执行接口家族**（`backend/domain/workflow/internal/nodes/node.go`）：`InvokableNode`（非流式，最常用）、`StreamableNode`、`CollectableNode`、`TransformableNode`，以及对应的 `*WOpt` 版本。封装型节点只需 `InvokableNode`。

### 3.4 HTTP 请求节点实现剖析

| 关注点 | 位置 |
|---|---|
| 前端枚举 | `frontend/.../base/src/types/node-type.ts:76`（`Http = '45'`） |
| 前端 registry | `frontend/.../playground/src/node-registries/http/node-registry.ts` |
| 前端表单 | `http/form-meta.tsx` / `http/form-render.tsx`（含 `ApiSetter`、`BodySetter`、`AuthSetter`、`ParametersInputGroup`） |
| 前端默认入参/出参 | `http/data-transformer.ts`（默认 outputs：`body`/`statusCode`/`headers`） |
| 后端 NodeType | `entity/node_meta.go:153`（`NodeTypeHTTPRequester`）、`:746`（`NodeTypeMetas` 条目） |
| 后端执行 | `internal/nodes/httprequester/http_requester.go`：`Config.Adapt`(195)、`Config.Build`(330)、`HTTPRequester.Invoke`(368) |
| 后端注册 | `internal/canvas/adaptor/to_schema.go:651` |
| 画布 VO | `entity/vo/canvas.go`：`HttpRequestNode`、`APIInfo`、`Body`、`Auth`、`HttpRequestSetting` |

**重要细节**：HTTP 节点后端把嵌套配置**展平为带 MD5 前缀的扁平 key**注册到 `NodeSchema.InputTypes`，例如：
```
__apiInfo_url_<md5>            // URL 模板变量
__headers_<md5>                __params_<md5>
__body_bodyData_json_<md5>     __body_bodyData_formData_<md5>
__auth_authData_bearerTokenData_token
```
定义在 `http_requester.go:705-720`，由 `adapt.go:220` 的 `setHttpRequesterInputsForNodeSchema` 写入。

> **对封装的影响**：若选择"复用 HTTP 节点执行逻辑"，固定入参必须按 `inputs.apiInfo/body/headers/params/auth/setting` 的 JSON 路径构造，才能命中现有 setter 与执行链路。

### 3.5 代码节点实现剖析

| 关注点 | 位置 |
|---|---|
| 前端枚举 | `base/src/types/node-type.ts:25`（`Code = '5'`） |
| 前端 registry | `playground/src/node-registries/code/` |
| 前端表单 | `code/form.tsx`：`InputsParametersField`（输入声明）+ `CodeField`（Monaco 代码编辑）+ `OutputsField`（输出声明） |
| 前端默认模板 | `form-extensions/setters/code/constants.ts`（`DEFAULT_TYPESCRIPT_CODE_PARAMS` / `DEFAULT_IDE_PYTHON_CODE_PARAMS`） |
| 后端 NodeType | `entity/node_meta.go:172`（`NodeTypeCodeRunner`）、`:332`（`NodeTypeMetas`） |
| 后端执行 | `internal/nodes/code/code.go`：`Config.Adapt`(119)、`Config.Build`(159)、`Runner.Invoke`(221) |
| 沙箱执行器 | `infra/coderunner/impl/{impl.go, sandbox/runner.go, direct/runner.go}` |
| 后端注册 | `internal/canvas/adaptor/to_schema.go:630` |

**关键结论**：
- 输入字段、输出字段在底层**完全是动态、用户声明的数据**（`Data.Inputs.InputParameters` / `Data.Outputs`），无静态 schema。
- 代码本身是**每节点存储的字符串**（`vo.CodeRunner.Code`），引擎不关心它从哪来——**可被固定模板替换**。
- **开源版沙箱强制 Python**（`code.go` Build 中硬编码 `only support python language`；`sandbox/runner.go` 仅支持 Python）。
- `CODE_RUNNER_TYPE=sandbox` 时使用 Deno 驱动的 Python 沙箱（`sandbox.py`），否则走 `direct` runner。

> **对封装的影响**：代码节点的"代码 + 输入输出 schema 都是数据"这一特性，使得"固化集合运算"可以**纯前端合成**，后端零改动。

---

## 4. 方案设计

### 4.1 节点一：封装 HTTP 请求节点

> 目标：固定接口与传参结构，用户只选入参值与输出字段子集。

#### 方案 0（强烈建议先评估）：自定义插件（Plugin）

Coze 的**插件节点（`NodeTypePlugin`）**本质上就是"固定 API + 声明式入参/出参 schema + 用户填入参取输出"。如果诉求是"把这个固定接口暴露成一个可复用、I/O 固定的调用单元"而**不强制要求专属画布品牌**，做成**自定义插件**即可，配置为主、几乎不用写节点代码。

- **工作量**：低（主要为插件配置 + 鉴权密钥，见 Wiki 4）。
- **取舍**：画布上显示为"插件节点"而非自定义图标/分类的独立节点；表单是插件标准表单而非完全自定义 UI。

#### 方案 A：前端 preset 壳（复用 `NodeTypeHTTPRequester`，后端零改动，适合验证）

- 新增前端节点目录 `node-registries/<your-http>/`，用自定义字段选择器替换 `ApiSetter`/`BodySetter` 等复杂表单。
- registry 的 `type` 可以是一个前端内部自定义类型，但 `meta.nodeDTOType` 必须指向 `StandardNodeType.Http`，这样保存给后端的仍是 HTTP 节点。
- 在 `formatOnSubmit`（`data-transformer.ts`）里把固定配置固化，把用户选择的入参映射成 HTTP 节点期望的结构：
  ```ts
  // 伪代码
  formatOnSubmit: (formData) => ({
    nodeMeta: formData.nodeMeta,
    inputs: {
      apiInfo: { method: FIXED_METHOD, url: FIXED_URL },
      params: mapSelectedInputsToParams(formData.selectedInputs),
      body: { bodyType: FIXED_BODY_TYPE, bodyData: mapSelectedInputsToBody(...) },
      headers: FIXED_HEADERS,
      auth: FIXED_AUTH,
      setting: { timeout: 120, retryTimes: 3 },
    },
    outputs: pickFixedOutputs(formData.selectedOutputKeys),
  })
  ```
- **难点**：需严格匹配 HTTP 节点的 JSON 路径与 MD5 前缀 key 体系，否则执行期取不到值。
- **持久化限制**：保存后的 schema 类型会变成 `Http = '45'`。如果重新打开时不额外识别 preset 标识并切回自定义 registry，用户看到的可能是普通 HTTP 节点完整表单。
- **工作量**：中。

#### 方案 B：新后端 NodeType，内部复用 `httprequester`（推荐用于"独立节点"诉求）

- 前后端都加一个新类型。
- 后端新 `Config` 在 `Adapt` 中**调用/内嵌 `httprequester.Config`**，把固定 URL/Method/Header/Auth 预先填好；在 `Build` 中返回一个包装了 `*httprequester.HTTPRequester` 的执行体，`Invoke` 时把固定配置与用户入参合并后转发。
- 前端只渲染"入参字段选择 + 输出字段选择"。
- **优点**：契约固定、不暴露 HTTP 复杂表单、UI 完全自定义、绕开 MD5 前缀 key 的耦合。
- **代价**：动 `node_meta.go`、`to_schema.go`、`vo/canvas.go`、新建 `internal/nodes/<your-http>/`。
- **工作量**：中。

#### 方案对比

| 维度 | 方案 0 插件 | 方案 A 前端 preset 壳 | 方案 B 新后端 NodeType |
|---|---|---|---|
| 后端改动 | 无 | 无 | 有（3 处 + 新包） |
| 前端改动 | 几乎无（配置） | 中（新 registry + 表单 + transformer） | 中（新 registry + 表单） |
| 专属 UI / 品牌 | 否 | 是 | 是 |
| 绕开 MD5 前缀 key | — | 否（需对齐） | 是 |
| 保存后仍是独立节点 | 否（插件标准节点） | 否，除非额外做 preset 恢复机制 | 是 |
| 推荐场景 | 仅需"固定接口调用单元" | 快速验证、不碰后端 | 生产级独立节点 |

### 4.2 节点二：集合运算节点（封装代码节点）

> 目标：固化交集/并集/差集代码，用户只选两个输入列表与输出字段。

#### 方案 A：前端 preset 壳（复用 `NodeTypeCodeRunner`，后端零改动，适合验证）

新增前端节点 `node-registries/set-operations/`：

1. **自定义表单**（替换 Code 节点的三件套）：
   - `listA`：输入字段选择器（类型限定 `list`）
   - `listB`：输入字段选择器（类型限定 `list`）
   - `operation`：单选（`intersection` / `union` / `difference`）
   - `outputName`：输出字段名
2. **`formatOnSubmit` 合成 Code 节点期望的 DTO**：
   ```ts
   // 伪代码
   const OP = { intersection: '&', union: '|', difference: '-' };
   formatOnSubmit: (fd) => ({
     nodeMeta: fd.nodeMeta,
     inputs: {
       inputParameters: [
         { name: 'list_a', type: LIST },
         { name: 'list_b', type: LIST },
       ],
       code: FIXED_PYTHON_TEMPLATE(fd.operation),  // 见下方模板
       language: LanguageEnum.PYTHON,               // = 3
     },
     outputs: [{ name: fd.outputName, type: LIST }],
   })
   ```
   固定 Python 模板示例：
   ```python
   async def main(args):
       a = set(args.params.get('list_a') or [])
       b = set(args.params.get('list_b') or [])
       return { "${outputName}": list(a & b) }   # 按 operation 替换运算符
   ```
3. `node-type.ts` 加枚举，`nodes-v2/constants.ts` 注册。
4. 配 `node-test.ts` 提取 `list_a` / `list_b` 作为试运行入参。

- **关键约束**：为了后端零改动，registry 的 `meta.nodeDTOType` 必须指向 `StandardNodeType.Code`。保存后的 schema 类型会是普通 Code 节点；重新打开时若没有 preset 恢复机制，可能暴露代码编辑器。
- **工作量**：中低。后端零改动，但需要接受持久化限制。
- **风险点**：Python 模板需通过后端 `validatePythonImports` 校验（仅允许内建模块 + 白名单第三方库），用纯内建 `set` 运算无问题。

#### 方案 B：新后端 NodeType（推荐用于生产独立节点，无沙箱）

新增 `NodeTypeSetOperations`，`Build` 返回一个**直接在进程内做集合运算的 Runner**（不经过 Python 沙箱）。

- **优点**：无沙箱开销、契约固定、类型更强，保存、重新打开、复制、发布后仍是独立节点。
- **代价**：前后端都改，工作量略高于方案 A。
- **何时选**：要求生产可维护、不能重新暴露代码编辑器、对延迟敏感、或不想依赖 Python 沙箱可用性时。

> **结论**：若只是验证交互和数据链路，可先走方案 A；若目标是交付一个真正的"集合运算节点"，建议直接走方案 B。

---

## 5. 可行性分析

| 维度 | 结论 |
|---|---|
| 框架是否支持 | ✅ 完全支持。节点 I/O 字段与代码/配置均为可序列化数据，"固化"= 在 `formatOnSubmit` / `Config.Adapt` 中代填，框架照常执行 |
| 是否有先例 | ✅ Wiki 10/11 有完整示例（JSON 序列化节点，[MR #215](https://github.com/coze-dev/coze-studio/pull/215)）；前端有 `rushx create:node` 脚手架 |
| 后端是否必须改 | ⚠️ 视方案而定。若只做 preset 壳且 `nodeDTOType` 指向已有 Code/Http，可**后端零改动**；若要保存后仍是独立节点，必须新增后端 NodeType |
| 是否触碰核心运行时 | ❌ 不触碰 Eino 核心控制流/数据流，仅在其上新增节点类型，风险可控 |
| 是否影响存量节点 | ❌ 新增独立 NodeType，与现有节点互不干扰（需保证 ID 不冲突） |
| 测试与试运行 | ✅ 框架提供单节点试运行（`node-test.ts`）与全流程试运行，封装节点可复用 |

**总体可行性：高。** 两个需求都落在框架设计的"舒适区"内。

---

## 6. 难度评估与工作量估算

> 估算基于"熟悉 Rush 单仓 + 略懂 FlowGram/Eino"的开发者；首次接触需另加 1–2 天学习成本。

| 任务 | 后端改动 | 前端改动 | 难度 | 估时 |
|---|---|---|---|---|
| 集合运算节点（方案 A） | 无 | 新 registry + 自定义表单 + transformer + 固定 Python 模板 + preset 恢复取舍 | 中低 | 1–2 人日 |
| 集合运算节点（方案 B） | 新 NodeType + 进程内 Runner | 新 registry + 表单 | 中 | 2–3 人日 |
| HTTP 封装 - 方案 0 插件 | 无 | 插件配置 | 低 | 0.5–1 人日 |
| HTTP 封装 - 方案 A 前端 preset 壳 | 无 | 新 registry + 表单 + 对齐 MD5 key 的 transformer + preset 恢复取舍 | 中 | 2–3 人日 |
| HTTP 封装 - 方案 B 新后端 | 新 NodeType + 复用 httprequester | 新 registry + 表单 | 中 | 3–4 人日 |

**主要学习成本**：FlowGram 的 `FormMetaV2` 表单引擎（`render/validate/effect/formatOnInit/formatOnSubmit`）。

---

## 7. 风险与注意事项

1. **节点类型 ID 冲突**：前端 `StandardNodeType` 值必须等于后端 `NodeTypeMetas.ID`，且全局唯一。自定义类型建议从 `1000+` 起。
2. **`nodeDTOType` 持久化边界**：后端零改动 preset 必须把 `nodeDTOType` 指向已有类型；这会导致保存后的 schema 不再天然保留自定义节点身份。
3. **节点面板启用列表**：除了 `NODES_V2`，还要检查 `get-enabled-node-types.ts`，否则节点可能注册了但不可添加。
4. **HTTP 节点的 MD5 前缀 key**（仅方案 A）：固定入参需严格对齐 `__apiInfo_url_<md5>` 等路径，否则执行期取不到值。方案 B 内嵌复用可绕开。
5. **开源版代码沙箱仅支持 Python**：集合运算固定模板必须用 Python，且需通过 `validatePythonImports`（内建模块 + 白名单）。纯 `set` 运算符合要求。
6. **图标资源**：需放置于 `docker/volumes/minio/default_icon/workflow_icon/`，`IconURI` 文件名与之匹配。
7. **试运行配置**：每个新节点的 `node-test.ts` 必须正确提取入参，否则单节点调试无法生成输入表单。
8. **版本/序列化兼容**：新增 `NodeType` 后，已保存的旧工作流 JSON 不受影响（仅新增类型，不修改既有类型 ID/字段）。注意 Wiki 11 提到的"禁止修改现有字段 ID 和类型"原则。
9. **异常处理**：如需超时/重试/异常分支，按 Wiki 11 在前端表单加入 `SettingOnError` 即可自动生效，无需后端额外开发。

---

## 8. 推荐方案与实施路径

### 推荐组合
- **集合运算节点** → 验证期可走 **方案 A（前端 preset 壳）**；生产交付建议走 **方案 B（新后端 NodeType）**，避免重新打开后退化成普通 Code 节点。
- **HTTP 封装节点** → **先评估方案 0（自定义插件）**；若必须独立 UI，走 **方案 B（新后端 NodeType 复用 httprequester）**。

### 建议实施顺序
1. **Step 1（0.5d）**：跑通 Wiki 10/11 的 JSON 序列化节点示例，熟悉 `rushx create:node` 与 `FormMetaV2`。
2. **Step 2（0.5d）**：明确两个节点是否需要"保存后仍是独立节点"。若需要，直接规划新后端 NodeType；若只是 PoC，再使用 preset 壳。
3. **Step 3（1–2d）**：实现集合运算节点。PoC 走方案 A；生产交付走方案 B。
4. **Step 4（0.5d）**：评估 HTTP 封装是否能用自定义插件满足（Wiki 4）。
5. **Step 5（3–4d）**：按评估结果实现 HTTP 封装节点（插件 or 方案 B）。
6. **Step 6**：单节点试运行 + 全流程试运行 + 保存后重新打开验证 + 异常处理联调。

---

## 9. 附录：关键文件索引

### 前端
- 节点类型枚举：`frontend/packages/workflow/base/src/types/node-type.ts`
- Registry 类型：`frontend/packages/workflow/base/src/types/registry.ts:125`
- 节点聚合注册：`frontend/packages/workflow/playground/src/nodes-v2/constants.ts`（`NODES_V2`）、`.../container/workflow-nodes-v2-contribution.ts`
- 节点启用列表：`frontend/packages/workflow/adapter/base/src/utils/get-enabled-node-types.ts`
- 保存时类型转换：`frontend/packages/workflow/nodes/src/workflow-json-format.ts`（`nodeDTOType` 覆盖 `json.type`）
- HTTP 节点：`frontend/packages/workflow/playground/src/node-registries/http/`
- Code 节点：`frontend/packages/workflow/playground/src/node-registries/code/`
- 脚手架：`frontend/packages/workflow/playground`（`rushx create:node`）

### 后端
- NodeType 常量与元信息：`backend/domain/workflow/entity/node_meta.go`
- 适配器注册：`backend/domain/workflow/internal/canvas/adaptor/to_schema.go`（`RegisterAllNodeAdaptors`）
- NodeSchema：`backend/domain/workflow/internal/schema/node_schema.go`
- 执行接口：`backend/domain/workflow/internal/nodes/node.go`
- HTTP 节点实现：`backend/domain/workflow/internal/nodes/httprequester/`
- Code 节点实现：`backend/domain/workflow/internal/nodes/code/code.go`
- 代码沙箱：`backend/infra/coderunner/impl/{impl.go, sandbox/runner.go, direct/runner.go}`
- 画布 VO：`backend/domain/workflow/entity/vo/canvas.go`

### 参考资料
- Wiki 10/11（新增节点类型前后端）
- Wiki 4（插件配置）
- Wiki 7（开发规范、本地调试）
- [MR #215](https://github.com/coze-dev/coze-studio/pull/215)（JSON 序列化节点示例）
- [FlowGram.ai 表单引擎文档](https://flowgram.ai/guide/advanced/form.html)
- [Eino 框架文档](https://www.cloudwego.io/zh/docs/eino/)
