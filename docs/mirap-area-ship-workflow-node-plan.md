# 网格提取区域船封装 HTTP 节点技术方案

> 日期：2026-07-08
> 状态：最小实现方案
> 适用范围：Coze Studio 工作流新增专属节点

## 1. 背景与目标

本方案用于新增一个封装型 HTTP 工作流节点：**网格提取区域船**。

节点底层仍然发起 HTTP 调用，但调用地址、Method、Header、Body 结构固定。用户在画布上只填写或选择业务入参，不需要配置 URL、Method、Header 等 HTTP 细节。输出不允许自由声明，只能在固定输出字段集合中选择子集。

本次按真实节点实现，而不是前端 preset 壳：

- 保存、重新打开后仍显示为专属节点。
- 前端 `StandardNodeType` 与后端 `NodeTypeMetas.ID` 保持一致。
- 后端读取鉴权配置，不把 token 写入前端代码或节点 schema。

## 2. 接口验证结果

已用样例参数调用接口，接口可正常返回。

固定请求：

```bash
POST https://mirap-test.elane.com/api/bigData/external_unifiedapi/getMmsiByAreawholeWorld
content-type: application/json
authorization: 从后端环境变量读取
```

请求体：

```json
{
  "points": "124 30.4,124.1 30.4,124.2 30.4,124.3 30.4,124 30.5,124.1 30.5,124.2 30.5,124.3 30.5,124 30.6,124.1 30.6,124.2 30.6,124.3 30.6,124 30.7,124.1 30.7,124.2 30.7,124.3 30.7",
  "startdate": "2026-07-04",
  "enddate": "2026-07-06"
}
```

响应顶层结构：

```json
{
  "code": "200",
  "message": "success",
  "datas": [
    {
      "mmsi": 371836000,
      "enName": "MOL ENDOWMENT",
      "age": 20.0,
      "countrycode": "PA",
      "shipType": "集装箱船",
      "length": 294.12,
      "width": 32.2,
      "dwt": 62949,
      "tradetype": "foreign"
    }
  ],
  "count": 0
}
```

注意：样例响应里 `count` 返回 `0`，但 `datas` 实际有多条记录。因此节点不要依赖接口 `count` 表示数量，节点输出的 `shipCount` 应由后端按 `len(datas)` 计算。

## 3. 固定节点契约

### 3.1 输入字段

节点表单只展示以下输入字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `points` | String | 是 | 网格点字符串，格式沿用接口要求，如 `lng lat,lng lat` |
| `startdate` | String | 是 | 开始日期，建议格式 `YYYY-MM-DD` |
| `enddate` | String | 是 | 结束日期，建议格式 `YYYY-MM-DD` |

最小实现中日期先按字符串处理，做非空和基础格式校验，不引入日期选择器或时区转换。

### 3.2 输出字段集合

用户只能从以下固定输出中选择子集：

| 字段 | 类型 | 来源 |
|---|---|---|
| `code` | String | 响应 `code` |
| `message` | String | 响应 `message` |
| `ships` | Array<Object> | 响应 `datas` |
| `shipCount` | Integer | 后端计算 `len(datas)` |
| `mmsiList` | ArrayInteger | 从 `datas[].mmsi` 提取 |
| `rawBody` | String | 原始响应文本，用于排查 |

`ships` 中单条船舶对象字段固定为：

| 字段 | 类型 |
|---|---|
| `mmsi` | Integer |
| `enName` | String |
| `age` | Number |
| `countrycode` | String |
| `shipType` | String |
| `length` | Number |
| `width` | Number |
| `dwt` | Integer |
| `tradetype` | String |

如仓库输出类型对 `ArrayInteger` 支持存在限制，`mmsiList` 可降级为 `ArrayString`，但实现前应先确认前端 `ViewVariableType` 与后端 `vo.TypeInfo` 的映射。

## 4. 实现方案

### 4.1 后端

新增真实后端节点类型：

- 在 `backend/domain/workflow/entity/node_meta.go` 新增 `NodeTypeMirapAreaShipExtractor`。
- 在 `NodeTypeMetas` 中分配 `1000+` 的唯一 ID，显示名为 `网格提取区域船`，分类可先放到 `utilities`。
- 在 `backend/domain/workflow/internal/canvas/adaptor/to_schema.go` 的 `RegisterAllNodeAdaptors()` 注册 adaptor。
- 新增节点包，例如 `backend/domain/workflow/internal/nodes/mirapareaship/`。

后端节点职责：

- `Adapt` 从前端节点 JSON 读取 `points/startdate/enddate` 三个输入定义，设置 `NodeSchema.InputTypes` 和输出类型。
- `Build` 创建执行体。
- `Invoke` 从运行时输入中取三项业务参数，组装固定 JSON 请求体。
- 从环境变量 `MIRAP_AREA_SHIP_AUTHORIZATION` 读取 `authorization` header。
- 使用固定 URL、`POST`、`content-type: application/json` 发起请求。
- 固定超时 120 秒。
- 非 2xx、JSON 解析失败、业务 `code != "200"` 均返回节点执行错误。
- 成功时返回用户已选择的字段；未选择字段不需要出现在输出 map 中。

建议响应结构体：

```go
type areaShipResponse struct {
    Code    string          `json:"code"`
    Message string          `json:"message"`
    Datas   []areaShip      `json:"datas"`
    Count   int64           `json:"count"`
}

type areaShip struct {
    MMSI        int64   `json:"mmsi"`
    EnName      string  `json:"enName"`
    Age         float64 `json:"age"`
    CountryCode string  `json:"countrycode"`
    ShipType    string  `json:"shipType"`
    Length      float64 `json:"length"`
    Width       float64 `json:"width"`
    DWT         int64   `json:"dwt"`
    TradeType   string  `json:"tradetype"`
}
```

### 4.2 前端

新增真实前端节点：

- 在 `frontend/packages/workflow/base/src/types/node-type.ts` 新增 `StandardNodeType.MirapAreaShipExtractor`，值与后端 `NodeTypeMetas.ID` 一致。
- 新增节点目录，例如 `frontend/packages/workflow/playground/src/node-registries/mirap-area-ship/`。
- 在 `frontend/packages/workflow/playground/src/node-registries/index.ts` 导出 registry。
- 在 `frontend/packages/workflow/playground/src/nodes-v2/constants.ts` 加入 `NODES_V2`。
- 在 `frontend/packages/workflow/adapter/base/src/utils/get-enabled-node-types.ts` 加入启用列表。

节点目录最小文件：

- `node-registry.ts`：声明 type、`meta.nodeDTOType`、尺寸、`outputsPath`、`test`。
- `form-meta.tsx`：挂载 render、校验、输出变量 effect、`formatOnInit`、`formatOnSubmit`。
- `form.tsx`：只渲染业务输入和固定输出选择。
- `data-transformer.ts`：负责前后端数据转换，保持保存 schema 为新节点类型。
- `constants.ts`：固定输入、固定输出、接口字段定义。
- `types.ts`：表单数据类型。
- `node-test.ts`：单节点试运行输入提取。
- `node-content.tsx`：画布卡片内容。
- `index.ts`：导出 registry。

输出选择 UI 不直接复用允许自由新增字段的通用 `OutputsField`。应维护一个 `selectedOutputs` 字段，用 checkbox 或多选组件限制用户只能从固定输出集合中选择。`formatOnSubmit` 再把 `selectedOutputs` 转换成真正的 `outputs` 数组。

### 4.3 鉴权配置

新增环境变量：

```bash
MIRAP_AREA_SHIP_AUTHORIZATION=elane_token_xxx
```

实现要求：

- 不把 token 写死到前端代码。
- 不把 token 写入节点 schema。
- 后端缺少该环境变量时，节点执行返回清晰错误，例如 `MIRAP_AREA_SHIP_AUTHORIZATION is required`。

## 5. 测试计划

### 5.1 后端单测

用 `httptest.Server` 覆盖：

- 成功响应：返回 `ships`、`shipCount`、`mmsiList`、`rawBody` 等字段正确。
- 接口非 2xx：返回执行错误，并包含状态码。
- 业务失败码：`code != "200"` 时返回执行错误。
- 响应 JSON 非法：返回解析错误。
- 缺少 `MIRAP_AREA_SHIP_AUTHORIZATION`：返回明确错误。
- `datas` 为空：`ships=[]`、`shipCount=0`、`mmsiList=[]`。

### 5.2 前端验证

- 节点出现在添加面板。
- 拖入画布后卡片展示正确。
- 表单只展示 `points/startdate/enddate` 与固定输出选择。
- 输入必填、日期基础格式校验有效。
- 用户无法自由新增输出字段。
- `formatOnSubmit` 保存结构符合后端 VO。
- `node-test.ts` 能正确生成单节点试运行输入表单。

### 5.3 联调验证

- 配置 `MIRAP_AREA_SHIP_AUTHORIZATION` 后，使用已验证样例参数进行单节点试运行。
- 确认实际请求体只包含 `points/startdate/enddate`。
- 确认返回字段与选择的输出子集一致。
- 保存工作流并重新打开，确认仍然是 `网格提取区域船` 专属节点，不退化为普通 HTTP 节点。
- 全流程试运行通过。

## 6. 实施顺序

1. 后端新增 NodeType、meta 和 adaptor 注册。
2. 后端新增 runner，并用 `httptest.Server` 完成单测。
3. 前端新增 `StandardNodeType`、registry 和节点目录。
4. 实现表单输入、固定输出选择、数据转换、单节点试运行配置。
5. 加入 `NODES_V2` 与 enabled-node-types。
6. 执行后端单测、前端相关测试或类型检查。
7. 本地配置 `MIRAP_AREA_SHIP_AUTHORIZATION`，进行画布试运行、保存、重开验证。

## 7. 默认假设

- 本次只封装 `getMmsiByAreawholeWorld` 一个接口。
- URL、Method、Header、Body 结构不暴露给用户配置。
- Cookie、Origin、Referer、浏览器 UA 等请求头不作为节点配置项；后端只发送接口必要 header。
- `shipCount` 以后端计算值为准，不使用接口返回的 `count`。
- `rawBody` 仅作为调试输出字段，默认可选。
