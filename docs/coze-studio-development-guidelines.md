# Coze Studio 本地开发规范与指南

> 来源：Coze Studio Wiki（快速开始、项目配置、开发规范、新增工作流节点类型、新增 API 接口）与当前仓库代码结构。
> 更新日期：2026-07-08。

本文档把官方 Wiki 中分散的前后端开发规范、开发调试流程、新增 API、新增工作流节点指南落地为本仓库内的开发参考。开发时优先遵守本文档；涉及工作流自定义节点方案设计时，同时阅读 `docs/custom-workflow-nodes-feasibility.md`。

## 1. 开发前必读

### 1.1 任务路由

| 任务类型 | 先读文档 | 重点检查 |
|---|---|---|
| 普通后端功能 | 本文档第 2、3、6 节 | DDD 分层、IDL 规范、错误码、单测 |
| 普通前端功能 | 本文档第 2、4、6 节 | Rush 包边界、现有 UI/状态管理、Vitest |
| 新增 API | 本文档第 5 节 | IDL、`idl/api.thrift`、`hz update`、前端 client、OpenAPI 鉴权 |
| 新增工作流节点 | 本文档第 7 节 + `docs/custom-workflow-nodes-feasibility.md` | 前后端 NodeType 一致、`nodeDTOType` 持久化、单节点试运行 |
| 模型/插件/基础组件配置 | 本文档第 8 节 | `backend/conf/model/`、插件配置、MinIO/对象存储等组件 |

### 1.2 本地环境与启动

官方 Wiki 的最低环境要求是 2 Core CPU、4 GiB RAM、Docker/Docker Compose。开发调试还需要 Go >= 1.24、Node >= 22、npm、Rush。

常用命令以仓库根目录为准：

```bash
# 首次或全量调试：启动中间件、Python 环境、后端服务
make debug

# 只启动中间件
make middleware

# 重新编译并启动后端
make server

# 准备前端依赖
bash scripts/setup_fe.sh

# 启动前端开发服务
cd frontend/apps/coze-studio
npm run dev
```

Docker 一体化部署使用：

```bash
make web
```

公网部署前必须评估安全风险：注册入口、代码节点 Python 执行环境、SSRF、服务监听地址、API 权限边界。

## 2. 架构与分层约束

### 2.1 后端目录职责

后端采用 DDD 风格，开发时按职责落位：

| 路径 | 职责 |
|---|---|
| `backend/api/` | HTTP handler、路由、中间件、请求响应绑定 |
| `backend/application/` | 应用服务，组合领域对象和基础设施能力，对 API 层提供用例入口 |
| `backend/domain/` | 核心领域逻辑、实体、值对象、业务规则，工作流核心也在这里 |
| `backend/crossdomain/` | 跨领域防腐层，避免领域间直接耦合 |
| `backend/infra/contract/` | 外部依赖接口契约 |
| `backend/infra/impl/` | 外部依赖实现，如数据库、缓存、消息队列、配置中心 |
| `backend/pkg/` | 无业务依赖的通用工具，可被各层使用 |
| `backend/types/` | 常量、错误码、DDL 等类型定义 |

原则：

- API 层只做协议适配、参数绑定、错误返回，不承载核心业务逻辑。
- 应用层编排 use case，领域规则放在 `domain/`。
- 跨领域调用优先走 `crossdomain/contract`，不要让领域包互相穿透。
- 基础设施依赖通过 contract 注入，避免领域层直接依赖具体实现。

### 2.2 前端目录职责

前端是 Rush monorepo：

| 路径 | 职责 |
|---|---|
| `frontend/apps/coze-studio/` | 主应用入口 |
| `frontend/config/` | ESLint、PostCSS、Rsbuild、Stylelint、Tailwind、TS、Vitest 配置 |
| `frontend/infra/` | 前端基础设施、IDL、插件、工具 |
| `frontend/packages/arch/` | 架构基础能力 |
| `frontend/packages/common/` | 通用组件与工具 |
| `frontend/packages/workflow/` | 工作流领域前端能力 |
| `frontend/packages/studio/` | Studio 业务域 |
| `frontend/packages/agent-ide/` | Agent IDE 业务域 |

原则：

- 优先复用本仓库已有包、组件、适配器和 design tokens。
- 内部包依赖使用 `workspace:*`。
- 不在根目录执行 `npm install`；依赖安装使用 `rush update`。
- 避免重复引入框架：构建沿用 Rsbuild/Rspack/Rollup，测试沿用 Vitest，UI 沿用 `@coze-arch/coze-design` 和仓库现有组件。

## 3. 后端开发规范

### 3.1 Go 规范

- 使用 `gofmt`/`go test` 保持基础质量。
- 新逻辑按现有包的错误处理方式返回，优先使用 `backend/types/errno` 和 `backend/pkg/errorx` 等现有机制。
- 新功能需要覆盖领域逻辑或关键应用服务测试；测试文件与被测文件同目录，命名为 `*_test.go`。

### 3.2 IDL 规范

Thrift IDL 是前后端接口契约，修改时遵守：

- Service、Method、Struct 使用驼峰命名。
- 字段使用蛇形命名。
- 一个 Thrift 文件通常只定义一个 Service，聚合服务除外。
- Method 只能有一个 request 和一个 response，命名为 `{Method}Request` / `{Method}Response`。
- Request 包含 `255: optional base.Base Base`，Response 包含 `255: optional base.BaseResp BaseResp`。
- 新增字段使用 `optional`，禁止新增 `required`。
- 禁止修改已有字段 ID 和类型，避免破坏兼容性。
- API 注解保持 RESTful 风格，参考现有模块。

### 3.3 后端单测

- 普通函数：`Test{FunctionName}(t *testing.T)`。
- 对象方法：`Test{ObjectName}{MethodName}(t *testing.T)`。
- Benchmark：`Benchmark{FunctionName}(b *testing.B)` 或 `Benchmark{ObjectName}{MethodName}(b *testing.B)`。
- 推荐 Table-Driven Tests 覆盖多种输入/输出。
- 优先使用 `testify` 断言和 `uber-go/mock` mock；尽量避免 patch 打桩。

## 4. 前端开发规范

### 4.1 语言与依赖

- 前端主要使用 TypeScript、React、Tailwind、Rsbuild/Rspack。
- 提交前确保相关包 lint/test 不报错。
- 不引入 Jest、Mocha 等替代 Vitest 的测试框架。
- 不引入新的 UI 框架替代现有 `@coze-arch/coze-design` / 仓库组件体系。

### 4.2 前端单测

Vitest 测试目录按包组织：

```text
package-root/
├── src/
│   ├── foo.ts
│   └── nested/bar.ts
└── __tests__/
    ├── foo.test.ts
    └── nested/bar.test.ts
```

规范：

- `__tests__` 与 `src` 同级。
- 测试文件与源码模块同名，并保持目录结构一致。
- 测试文件以 `.test.ts` 或 `.test.tsx` 结尾。
- 单测按 AAA 组织：arrange、act、assert。
- `import` 放文件顶部；全局 `vi.mock` 放 import 后；`describe` 内包含多个 `it`，避免不必要的深层嵌套。
- 若单测过长，优先判断源码模块是否过复杂，而不是把一个源码模块拆成多个测试文件。

## 5. 新增 API 接口流程

### 5.1 编写 IDL

1. 在 `idl/` 下新增或修改 thrift 文件。
2. 新模块需要在 `idl/api.thrift` 中 include 并扩展 service；现有模块新增接口通常不需要改 `idl/api.thrift`。
3. Request/Response 和字段兼容性遵守第 3.2 节。

### 5.2 生成并实现后端

```bash
cd backend
hz update -idl ../idl/api.thrift -enable_extends
```

生成 handler 后：

- handler 位于 `backend/api/handler/coze/...`。
- handler 负责 `BindAndValidate`、调用应用服务、统一返回。
- 业务逻辑放 application/domain，不要堆在 handler。

### 5.3 生成前端 Client 或配置 OpenAPI 鉴权

如果前端页面需要调用新 API：

```bash
cd frontend/packages/arch/api-schema
npm run update
```

如果是 OpenAPI 且不需要前端页面：

- 检查 `backend/api/middleware/openapi_auth.go`。
- 在 `needAuthPath` 中添加需要鉴权的 path。

## 6. 验证与排障

### 6.1 常用验证

```bash
# 后端
cd backend
go test ./...

# 前端特定 app
cd frontend/apps/coze-studio
npm run test
npm run lint

# Rush 全仓，成本较高，按需使用
rush test
rush lint
```

### 6.2 Docker 与日志

常见容器包括 `coze-server`、`coze-mysql`、`coze-redis`、`coze-milvus`、`coze-elasticsearch`、`coze-nsqlookupd`、`coze-nsqadmin`、`coze-nsqd`、`coze-minio`、`coze-etcd`。

```bash
docker ps -a
docker logs coze-server
docker logs coze-mysql
docker logs coze-redis
```

页面接口报错时：

1. 浏览器 DevTools 查看失败请求。
2. 从响应头获取 `x-log-id`。
3. 到 `coze-server` 日志中按 log id 搜索。
4. 返回错误码时，在 `backend/types/errno` 搜索错误定义。

## 7. 新增工作流节点指南

新增工作流节点必须同时考虑前端展示、保存 schema、后端执行、试运行和重新打开后的还原行为。

### 7.1 前端节点开发

核心文件：

| 文件/目录 | 作用 |
|---|---|
| `frontend/packages/workflow/base/src/types/node-type.ts` | `StandardNodeType` 枚举 |
| `frontend/packages/workflow/adapter/base/src/utils/get-enabled-node-types.ts` | 节点面板启用列表 |
| `frontend/packages/workflow/playground/src/node-registries/<node>/` | 节点 registry、表单、数据转换、试运行 |
| `frontend/packages/workflow/playground/src/nodes-v2/constants.ts` | `NODES_V2` 聚合注册 |
| `frontend/packages/workflow/nodes/src/workflow-json-format.ts` | 保存时 `nodeDTOType` 覆盖 `json.type` 的位置 |

脚手架：

```bash
cd frontend/packages/workflow/playground
rushx create:node
```

前端节点最小清单：

- `node-registry.ts`：声明 `type`、`meta.nodeDTOType`、尺寸、路径、`formMeta`、`test`。
- `form-meta.tsx`：声明 render、validate、effect、`formatOnInit`、`formatOnSubmit`。
- `form.tsx`：表单渲染。
- `data-transformer.ts`：前后端数据转换。
- `node-test.ts`：单节点试运行输入提取。
- `node-content.tsx`：画布卡片内容。
- `constants.ts` / `types.ts`：固定输入输出、表单类型。
- `index.ts`：导出。

### 7.2 `type` / `nodeDTOType` 规则

`WorkflowNodeRegistry.type` 用于前端画布识别和匹配 registry；`meta.nodeDTOType` 用于保存时写入后端 schema。

保存时 `workflow-json-format.ts` 会把 `json.type` 改为 `nodeDTOType`。因此：

- 如果 `nodeDTOType` 指向已有类型（如 Code/Http），后端可以零改动，但保存后 schema 会退化为已有类型；重新打开时需要额外 preset 恢复逻辑，否则会显示普通 Code/Http 表单。
- 如果 `nodeDTOType` 指向新类型，必须新增后端 `NodeTypeMetas.ID` 和 adaptor。
- 生产级独立节点优先新增后端 NodeType，不建议只做前端壳。

### 7.3 后端节点开发

核心文件：

| 文件/目录 | 作用 |
|---|---|
| `backend/domain/workflow/entity/node_meta.go` | 后端 `NodeType` 常量、`NodeTypeMetas` ID、名称、分类、图标、执行元信息 |
| `backend/domain/workflow/internal/canvas/adaptor/to_schema.go` | `RegisterAllNodeAdaptors()` 注册 adaptor |
| `backend/domain/workflow/entity/vo/canvas.go` | 前端 schema 的 `Inputs` 类型；复杂节点可增加专属配置结构 |
| `backend/domain/workflow/internal/nodes/<node>/` | 节点 Config、Adaptor、Builder、Runner |
| `backend/domain/workflow/internal/nodes/node.go` | 执行接口定义 |

后端节点最小模型：

1. `Config.Adapt(ctx, *vo.Node, ...)`：把前端节点 JSON 转成 `schema.NodeSchema`，设置输入输出类型。
2. `Config.Build(ctx, *schema.NodeSchema, ...)`：创建可执行节点。
3. Runner 实现执行接口，常见为 `InvokableNode.Invoke(ctx, map[string]any) (map[string]any, error)`。
4. 在 `node_meta.go` 加唯一 ID 和元信息。
5. 在 `RegisterAllNodeAdaptors()` 注册。

节点执行接口：

- `InvokableNode`：非流式输入、非流式输出，大多数普通节点使用。
- `StreamableNode`：非流式输入、流式输出。
- `CollectableNode`：流式输入、非流式输出。
- `TransformableNode`：流式输入、流式输出。
- 带 `WOpt` 的版本用于需要透传 NodeOption 的复合或特殊节点。

### 7.4 工作流节点测试清单

- 节点能出现在添加面板。
- 拖入画布后卡片、输入、输出展示正确。
- 表单必填、类型限制、字段名校验有效。
- `formatOnSubmit` 保存结构符合后端 VO。
- 单节点试运行可生成输入表单并执行。
- 全流程试运行可执行。
- 保存后重新打开，仍然是预期节点形态。
- 复制、发布、导入导出不破坏 schema。
- 异常分支、超时、重试、`SettingOnError` 按需求验证。

## 8. 配置类开发参考

### 8.1 模型配置

模型可在管理后台 `http://localhost:8888/admin/#model-management` 添加。配置时注意：

- 智能体和工作流按模型 ID 调用模型；线上模型不要随意改 ID。
- 第三方 OpenAI-compatible 服务通常配置到 `/v1`，不要填到 `/chat/completions`。
- Ollama 在 Docker bridge 网络中不能使用容器内 `localhost` 指向宿主机，可使用宿主机 IP 或 `http://host.docker.internal:11434`。
- Qwen3 非流式 thinking 兼容性需要按配置说明处理。

### 8.2 插件配置

插件分为官方内置插件、自定义插件、商业版插件。封装固定 HTTP API 时，优先评估自定义插件，因为它天然具备固定 API、声明式入参/出参、用户填参调用的形态。

相关路径：

- `backend/conf/plugin/pluginproduct/`
- `backend/conf/plugin/common/oauth_schema.json`

### 8.3 基础组件

上传、对象存储、知识库等能力依赖基础组件配置。涉及图片/文件/向量/搜索能力时，先确认 MinIO、Milvus、Elasticsearch、Redis、MySQL 等中间件健康。

## 9. 资料来源

- [2. 快速开始](https://github.com/coze-dev/coze-studio/wiki/2.-%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B)
- [3. 模型配置](https://github.com/coze-dev/coze-studio/wiki/3.-%E6%A8%A1%E5%9E%8B%E9%85%8D%E7%BD%AE)
- [4. 插件配置](https://github.com/coze-dev/coze-studio/wiki/4.-%E6%8F%92%E4%BB%B6%E9%85%8D%E7%BD%AE)
- [5. 基础组件配置](https://github.com/coze-dev/coze-studio/wiki/5.-%E5%9F%BA%E7%A1%80%E7%BB%84%E4%BB%B6%E9%85%8D%E7%BD%AE)
- [6. API 参考](https://github.com/coze-dev/coze-studio/wiki/6.-API-%E5%8F%82%E8%80%83)
- [7. 开发规范](https://github.com/coze-dev/coze-studio/wiki/7.-%E5%BC%80%E5%8F%91%E8%A7%84%E8%8C%83)
- [10. 新增工作流节点类型（前端）](https://github.com/coze-dev/coze-studio/wiki/10.-%E6%96%B0%E5%A2%9E%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%8A%82%E7%82%B9%E7%B1%BB%E5%9E%8B%EF%BC%88%E5%89%8D%E7%AB%AF%EF%BC%89)
- [11. 新增工作流节点类型（后端）](https://github.com/coze-dev/coze-studio/wiki/11.-%E6%96%B0%E5%A2%9E%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%8A%82%E7%82%B9%E7%B1%BB%E5%9E%8B%EF%BC%88%E5%90%8E%E7%AB%AF%EF%BC%89)
- [12. 新增 API 接口](https://github.com/coze-dev/coze-studio/wiki/12.-%E6%96%B0%E5%A2%9E-API-%E6%8E%A5%E5%8F%A3)
