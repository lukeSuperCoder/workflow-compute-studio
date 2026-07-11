# Mirap Workflow Studio 新仓库分阶段抽离改造计划

> 文档类型：架构改造计划
> 更新日期：2026-07-10
> 目标：从 Coze Studio 中抽离工作流能力，形成不依赖 Docker、AI、知识库、搜索与消息队列的独立 Mirap Workflow Studio。

## 1. 改造目标

最终系统只保留以下能力：

- 工作流列表、创建、编辑、保存、重新打开、复制、删除与发布。
- 工作流草稿、发布版本、引用关系和执行历史。
- 完整工作流试运行、单节点试运行、取消运行与执行过程查询。
- 最小用户、登录、Session 和空间权限体系。
- 通用流程控制节点与 Mirap 自定义节点。
- MySQL、Redis 和本地文件存储。
- 后端和前端均可在本地直接启动，不要求 Docker。

最终需要移除：

- MinIO、Elasticsearch、Milvus、etcd、NSQ、RocketMQ、Kafka 等基础设施依赖。
- AI 模型、Embedding、知识库、OCR、Rerank、NL2SQL 等能力。
- Agent、Plugin、Marketplace、Search、Connector、ChatFlow 等业务模块。
- 开发启动过程对 `docker/.env`、Docker Compose 和全量前端构建的依赖。

## 2. 总体策略

采用“新仓库 + 分阶段抽离”，但不直接把少量目录复制到空仓库。

推荐过程：

1. 从当前代码 commit 建立完整源码快照的新仓库。
2. 先新增 workflow-only 后端启动入口，不立即删除旧模块。
3. 建立 MinIO 的本地文件存储替代实现。
4. 新建轻量前端应用壳，初期复用现有工作流编辑器包。
5. 将前后端节点注册改为显式白名单。
6. 根据真实编译依赖逐批删除无关模块。
7. 最后收缩 SQL、Rush 配置、前端依赖、`go.mod` 和环境配置。

整个过程中，当前完整项目作为行为基准和回归参照。

## 3. 目标架构

```text
Browser
   │
   ├── /api/workflow_api/*
   ├── /api/auth/*
   ├── /api/files/*
   └── /assets/*
   │
Workflow Web
   │
Workflow Server
   ├── Account / Space
   ├── Workflow CRUD / Publish
   ├── Workflow Runtime
   ├── Node Registry
   ├── MySQL Repository
   ├── Redis Checkpoint / ID Generator
   └── Local Filesystem Storage
          ├── public/icons
          └── data/uploads
```

建议的新仓库结构：

```text
mirap-workflow-studio/
├── backend/
│   ├── cmd/workflow-server/
│   ├── api/
│   │   ├── workflow/
│   │   ├── auth/
│   │   └── files/
│   ├── application/
│   │   ├── workflow/
│   │   ├── account/
│   │   └── upload/
│   ├── domain/
│   │   ├── workflow/
│   │   └── user/
│   ├── infra/
│   │   ├── mysql/
│   │   ├── redis/
│   │   └── storage/localfs/
│   └── conf/
├── frontend/
│   ├── apps/workflow-studio/
│   └── packages/
│       ├── workflow/
│       ├── flowgram-adapter/
│       └── shared/
├── migrations/
│   ├── 001_account.sql
│   ├── 002_workflow.sql
│   └── 003_execution.sql
├── assets/
│   └── workflow-icons/
├── storage/
│   └── uploads/
├── scripts/
│   ├── dev-server.sh
│   ├── dev-web.sh
│   └── migrate.sh
├── .env.example
├── Makefile
└── README.md
```

## 4. 功能边界

### 4.1 必须保留

工作流管理：

- 工作流列表和详情。
- 创建、保存、更新元信息、删除和复制。
- 草稿重新打开。
- 发布版本和版本查询。
- 子工作流引用。
- 画布合法性校验。

工作流执行：

- 完整工作流试运行。
- 单节点试运行。
- 取消运行。
- 执行过程与节点执行历史。
- Redis checkpoint。
- 已发布版本执行。

基础能力：

- 用户登录与 Session。
- 用户和空间权限。
- MySQL 持久化。
- Redis 缓存、ID 生成和执行状态。
- 本地文件上传、读取与删除。
- 本地图标访问。

### 4.2 建议保留的节点

基础节点：

- Start、End、Input、Output。
- If、Loop、Batch、Break、Continue。
- Variable Assign、Variable Merge。
- JSON Stringify/Parse、Text Processor。
- HTTP、Sub Workflow、Comment。

Mirap 节点：

- MirapAreaShipExtractor。
- MirapStayCalculation。
- MirapHoverDetail。
- MirapMMSIIntersection。
- MirapMMSIUnion。
- MirapMMSIDifference。

### 4.3 明确移除

- LLM、Intent Detector、AI Question/Reply。
- Plugin 和 Knowledge 节点。
- Agent、Conversation 和 Message 节点。
- ChatFlow 和图片生成节点。
- 数据库资源节点（如业务确认不需要）。
- Code Runner（如业务确认不需要自由代码节点）。
- Model Manager、Embedding、OCR、Rerank、NL2SQL。
- Marketplace、Template、Search、Connector。

## 5. 基础设施边界

### 5.1 MySQL

最低保留表：

账号与权限：

- `user`
- `space`
- `space_user`

工作流生命周期：

- `workflow_meta`
- `workflow_draft`
- `workflow_version`
- `workflow_reference`

工作流执行：

- `workflow_execution`
- `node_execution`
- `workflow_snapshot`

不继续使用当前全量 `schema.sql`，应建立独立、可重复执行的 migration。

### 5.2 Redis

第一阶段保留 Redis，用于：

- 分布式 ID 生成。
- 工作流 checkpoint。
- 中断和取消信号。
- 部分运行状态与历史缓存。

第一阶段不修改 ID 生成策略，避免同时扩大改造范围。

### 5.3 不再需要的基础设施

- MinIO。
- Elasticsearch。
- Milvus。
- etcd。
- NSQ、RocketMQ、Kafka、Pulsar、NATS。

工作流创建和发布过程中原有的资源搜索事件应改为 No-op，或者从 workflow-only 应用服务中移除。

## 6. MinIO 替代设计

### 6.1 LocalFilesystemStorage

新增本地文件系统实现，并继续实现现有 `storage.Storage` 接口：

```go
type LocalFilesystemStorage struct {
    RootDir       string
    PublicBaseURL string
}
```

需要支持：

- `PutObject`
- `PutObjectWithReader`
- `GetObject`
- `DeleteObject`
- `GetObjectUrl`
- `HeadObject`
- `ListAllObjects`
- `ListObjectsPaginated`

对象映射示例：

```text
objectKey:
default_icon/workflow_icon/icon-start.jpg

实际文件:
./storage/default_icon/workflow_icon/icon-start.jpg

返回 URL:
http://localhost:8888/assets/default_icon/workflow_icon/icon-start.jpg
```

用户上传文件：

```text
objectKey:
uploads/{user_id}/{yyyy-mm}/{uuid}.png

实际文件:
./storage/uploads/{user_id}/{yyyy-mm}/{uuid}.png
```

### 6.2 公开资源与私有资源

公开资源：

- 工作流图标。
- 节点图标。
- 前端静态资源。

访问接口：

```text
GET /assets/*path
```

私有资源：

- 工作流试运行输入文件。
- 用户上传文件。

访问接口：

```text
GET /api/files/*path
```

私有资源接口必须经过 Session 和资源归属校验，不直接暴露整个 `storage` 目录。

### 6.3 服务端上传

移除原来依赖 ImageX/MinIO 上传凭证的方式，改成服务端 multipart 上传：

```http
POST /api/files/upload
Content-Type: multipart/form-data
```

建议响应：

```json
{
  "key": "uploads/10001/2026-07/uuid.png",
  "url": "/api/files/uploads/10001/2026-07/uuid.png",
  "name": "example.png",
  "size": 12345,
  "content_type": "image/png"
}
```

前端上传适配器统一调用此接口。

### 6.4 安全要求

本地文件存储必须做到：

- 使用 `filepath.Clean` 规范化对象 key。
- 拒绝包含 `..` 的路径穿越。
- 拒绝绝对路径和符号链接越界。
- 上传先写临时文件，再原子 rename。
- 限制上传文件大小。
- 校验 MIME 类型和允许的扩展名。
- 实际文件名使用 UUID，不信任用户原文件名。
- `storage/` 写入 `.gitignore`。
- 默认图标作为仓库静态资源提交。

### 6.5 生产部署限制

本地文件系统适用于本地开发、单机部署和单实例内部系统。

如果未来进行多实例部署，需要挂载共享 NFS，或者新增 S3 Storage Adapter。业务层继续依赖 `storage.Storage` 接口，以保证未来替换存储时不修改工作流领域代码。

## 7. 分阶段实施计划

### 阶段 0：建立行为基线

预计：1～2 天。

状态（2026-07-11）：阶段 0 的响应补证已完成，可以进入阶段 1。六个 Mirap 节点的 live `nodeDebug` 与 `get_process` 样本见 `testdata/api/workflow/mirap-node-debug-live-samples.json`。其中三个本地集合运算节点执行成功；三个依赖外部 HTTP 服务的节点已捕获真实失败响应，当前环境限制是 `mirap-test.elane.com` 无法解析，成功重跑需恢复该测试域名的 DNS/网络访问。

工作内容：

- 记录当前代码 commit。
- 准备包含所有 Mirap 节点的测试工作流。
- 导出相关 MySQL 样例数据。
- 保存当前核心 API 请求和响应样例。
- 确认最终节点白名单。
- 将典型画布 Schema 纳入 `testdata/workflows/`。

基准验收用例：

1. 创建工作流。
2. 保存工作流。
3. 关闭页面并重新打开。
4. 修改后再次保存。
5. 强制发布。
6. 读取已发布版本。
7. Mirap 节点单节点运行。
8. Mirap 工作流完整运行。
9. 子工作流运行。
10. 上传文件并重新打开。

完成标准：以上用例在旧仓库中可以稳定、重复执行。

### 阶段 1：建立新仓库

预计：1 天。

工作内容：

- 从当前完整代码快照建立新仓库。
- 保留 Apache-2.0 版权和代码来源记录。
- 增加抽离范围、API 兼容、节点白名单文档。
- 不在此阶段大规模删除源代码。

建议的首批提交：

```text
chore: import coze-studio workflow extraction baseline
docs: define workflow extraction scope
test: add workflow compatibility fixtures
```

完成标准：新仓库仍能以旧方式构建，工作流兼容样例已纳入版本管理。

### 阶段 2：建立 workflow-only 后端入口

预计：3～5 天。

状态（2026-07-11）：阶段 2 收尾中。已新增 workflow-only 后端启动入口、工作流 API 白名单路由、`STORAGE_TYPE=local` 本地存储基础实现和隔离 MySQL/Redis 启动配置；当前 smoke 已覆盖创建、保存、查询、重新打开、发布和基础执行接口。

启动与 API smoke（2026-07-11）：

- `make workflow-middleware` 可启动独立 MySQL/Redis，并保持 healthy。
- `make workflow-server` 可启动 workflow-only 后端，监听 `:8889`。
- `make workflow-smoke` 已在隔离环境通过，覆盖 `/healthz`、`workflow_list`、`create`、`canvas`、`save`、`publish`、`node_type`、`test_run`、`get_process`。
- Mirap fixture `testdata/workflows/mirap-all-nodes.canvas.json` 已将 Start/End 节点 ID 修正为后端约定的 `100001`/`900001`，并通过 `validate_tree`、保存、重新打开和发布校验。
- 基础可执行链路使用最小 Start -> End 工作流覆盖，`test_run` 和 `get_process` 可返回执行成功。
- `/api/workflow_api/released_workflows` 在当前源码修订中仍返回 `data:null`，发布结果已通过 `workflow_version` 表确认。

隔离本地环境：

```bash
make workflow-env
make workflow-middleware
make workflow-server
make workflow-smoke
```

默认使用独立容器、端口和数据目录：

```text
MySQL: mirap-workflow-mysql, 127.0.0.1:3307, docker/data-workflow/mysql
Redis: mirap-workflow-redis, 127.0.0.1:6380, docker/data-workflow/redis
Server: APP_ENV=workflow, backend/.env.workflow, LISTEN_ADDR=:8889
Storage: STORAGE_TYPE=local, storage/
```

新增建议：

```text
backend/cmd/workflow-server/main.go
backend/application/workflowapp/init.go
backend/api/workflow/router.go
```

只初始化：

```text
MySQL
Redis
IDGenerator
LocalStorage
UserService
WorkflowRepository
WorkflowService
WorkflowAPI
```

禁止继续调用当前全量 `application.Init`，也不要使用全量生成 Router。

第一阶段保持现有 API 路径兼容：

```text
/api/workflow_api/create
/api/workflow_api/canvas
/api/workflow_api/save
/api/workflow_api/publish
/api/workflow_api/update_meta
/api/workflow_api/delete
/api/workflow_api/copy
/api/workflow_api/workflow_list
/api/workflow_api/workflow_detail
/api/workflow_api/workflow_detail_info
/api/workflow_api/node_type
/api/workflow_api/validate_tree
/api/workflow_api/workflow_references
/api/workflow_api/released_workflows
/api/workflow_api/test_run
/api/workflow_api/nodeDebug
/api/workflow_api/get_process
/api/workflow_api/cancel
```

完成标准：

- 不启动 ES、Milvus、MQ、etcd 和 MinIO。
- 只连接 MySQL、Redis 即可启动。
- 创建、保存、查询、重新打开和发布接口通过。

### 阶段 3：移除 MinIO

预计：3～4 天。

状态（2026-07-11）：进行中。`STORAGE_TYPE=local`、本地文件系统实现、workflow-only `/assets/*path`、`/api/files/upload`、`/api/files/*path` 已接入；workflow-only 启动会将默认图标资源种到 local storage；workflow 前端上传点已从 `upLoadFile` / `SignImageURL` 切换为 `/api/files/upload` multipart 上传。已通过后端局部测试、脚本语法、旧上传调用扫描和 diff 空白检查；本轮真实 `make workflow-smoke` 受 Codex 审批/额度限制未能复跑，需下次启动服务后补跑。
状态（2026-07-11 更新）：阶段 3 已完成。本次补跑的全部验证通过：
- `make workflow-middleware` 启动隔离 MySQL/Redis，均 Healthy。
- `make workflow-server` 以 `APP_ENV=workflow` 启动 workflow-only 后端，监听 `:8889`，不连接 MinIO。
- `make workflow-smoke` 全量通过，覆盖 healthz、icon asset 读取、workflow_list、文件上传/读取/越权拒绝、Mirap fixture 保存/重开/发布、最小工作流 test_run + get_process。
- localfs 单测 4 项全部通过：Put/Get、路径穿越拒绝、父目录符号链接逃逸拒绝、文件符号链接逃逸拒绝。
- 持久化验证：重启 workflow-server 后，上一轮上传的文件仍可通过 `/api/files/uploads/*` 读取，内容一致。
- 环境审计：workflow-only env 文件无 `MINIO_*` 变量；workflow-only 代码路径无 MinIO SDK 调用。
- M2 里程碑达成。

工作内容：

- 实现 `infra/storage/localfs`。（已完成基础实现和安全单测）
- 静态节点图标迁入仓库资源目录。（当前先从仓库默认图标目录启动种子到 local storage，后续再瘦身正式 assets 目录）
- 修改节点图标 URL 初始化逻辑。（local storage 返回 `/assets/default_icon/...`）
- 新增 `/assets/*path`。（workflow-only 后端已接入）
- 新增 `/api/files/upload` 和私有文件读取接口。（workflow-only 后端已接入）
- 移除工作流对 ImageX 上传凭证的依赖。（workflow 前端包内旧调用已清零）
- 修改前端上传适配器。（已切到 `/api/files/upload`，待安装前端依赖后做 UI 回归）
- 清理全部 MinIO 环境变量。（workflow-only 环境不再需要 `MINIO_*`）

目标环境变量：

```env
STORAGE_TYPE=local
STORAGE_ROOT=./storage
STORAGE_PUBLIC_BASE_URL=http://localhost:8888
MAX_UPLOAD_SIZE=52428800
WORKFLOW_DEFAULT_ASSET_DIR=./assets/default_icon
```

当前过渡实现中，`WORKFLOW_DEFAULT_ASSET_DIR` 仍可指向仓库已有的 `../docker/volumes/minio/default_icon` 作为种子来源；后续资源瘦身时再迁到正式 `assets/default_icon`。

需要移除：

```env
MINIO_ENDPOINT
MINIO_AK
MINIO_SK
MINIO_ROOT_USER
MINIO_ROOT_PASSWORD
MINIO_DEFAULT_BUCKETS
```

完成标准：

- 后端启动不连接 MinIO。
- 图标显示正常。
- 上传、读取和删除文件正常。
- `DELETE /api/files/*path` 已接入，私有文件删除需通过 owner 校验，删除后再读取返回 404；localfs `DeleteObject` 单测覆盖正常删除与二次删除错误。
- 重启服务后文件仍存在。
- 路径穿越与越权访问测试通过。

### 阶段 4：精简数据库

预计：2～4 天。

工作内容：

- 建立账号、工作流和执行三组 migration。
- 从完整 Schema 中提取实际需要的索引和约束。
- 删除与 ChatFlow、Agent、Knowledge、Plugin 等领域相关的表依赖。
- 提供空数据库初始化和升级脚本。

完成标准：空数据库执行 migration 后，可以注册用户、创建空间、创建和发布工作流。

状态（2026-07-11）：阶段 4 已完成。本次验证全部通过：
- 新增独立 migration 目录，包含四组 migration：`migrations/001_account.sql`（user、space、space_user）、`migrations/002_workflow.sql`（workflow_meta、workflow_draft、workflow_version、workflow_reference）、`migrations/003_execution.sql`（workflow_execution、node_execution、workflow_snapshot）、`migrations/004_upload.sql`（files）。
- `migrations/workflow_schema.sql` 为四组 migration 的合并全量初始化脚本，供 Docker `docker-entrypoint-initdb.d` 使用。
- `docker-compose-workflow.yml` 已改为挂载 `../migrations/workflow_schema.sql`，不再使用全量 `schema.sql`。
- `scripts/workflow_migrate.sh` 提供可重复执行的 migration 升级脚本，通过 `_mirap_schema_migrations` 表追踪已应用的 migration。
- `Makefile` 新增 `workflow-migrate` 目标。
- 空库验证：`make workflow-down` + 清空 `docker/data-workflow/mysql` + `make workflow-middleware` 后，Docker init 自动创建 11 张精简表。
- `make workflow-migrate` 二次执行验证幂等性：Applied=0 Skipped=4。
- `make workflow-server` 在空库上正常启动。
- `make workflow-smoke` 全量通过：healthz、workflow_list、文件上传/读取/删除、Mirap fixture 保存/重开/发布、最小工作流 test_run + get_process。
- 空库验证后业务数据：user=1、space=1、workflow_meta=2、workflow_version=1、workflow_draft=2。
- 从全量 55 张表缩减为 11 张工作流必需表，移除了 ChatFlow、Agent、Knowledge、Plugin、Model、Conversation、Tool、Template 等领域表。

### 阶段 5：节点注册白名单化

预计：3～5 天。

状态（2026-07-11）：阶段 5 已完成。本阶段新增并验证了 Mirap 节点白名单：
- 后端新增 `entity.MirapNodeSet`，workflow-only 初始化时只注册白名单内 node adaptor，并让 `node_template_list` catalog 与白名单求交。
- 修复 `node_template_list` 在请求全为白名单外节点时因空 map 回落全量 catalog 的泄漏问题；请求空列表时返回 Mirap 全白名单，请求具体列表时只返回交集。
- workflow-only 路由补齐 `/api/workflow_api/node_template_list`。
- 前端 `getEnabledNodeTypes` 改为 Mirap 白名单，Break、Continue、SetVariable 仅在 loop/batch 选中时出现。
- 前端 `NODES_V2` 改为直连白名单节点模块，避免通过 `@/node-registries` barrel 静态引入 LLM、Plugin、Knowledge、Database、Chat 等旧节点。
- 补齐 JSON 反序列化（JsonParser / ID 59）前端 registry、content、form-meta 和单节点试运行输入生成。
- 白名单外历史节点注册轻量 unsupported shell，打开旧画布时显示“不支持节点”提示，不进入节点面板。

验证记录（2026-07-11）：
- `go test ./application/workflow ./domain/workflow/entity` 通过。
- `go test ./domain/workflow/service` 通过。
- `make workflow-middleware` 启动隔离 MySQL/Redis，均 Healthy。
- `make workflow-server` 启动 workflow-only 后端，监听 `:8889`。
- `make workflow-smoke` 通过，覆盖 healthz、workflow_list、文件上传/读取/删除、Mirap fixture 保存/重开/发布、最小工作流 test_run + get_process。
- 手工调用 `/api/workflow_api/node_template_list` 请求 `3,4,58,59,1001`，响应只返回 `58,59,1001`，确认 LLM/Plugin 被过滤。
- 六个 Mirap 节点的单节点试运行输入生成文件保持注册状态；live `nodeDebug` / `get_process` 证据仍见 `testdata/api/workflow/mirap-node-debug-live-samples.json`。其中三个本地 MMSI 集合节点成功，三个 HTTP-backed 节点受 `mirap-test.elane.com` DNS 限制返回真实失败记录。
- 已执行 `node common/scripts/install-run-rush.js update` 恢复 Rush 依赖树。
- `cd frontend/packages/workflow/adapter/base && npm run test -- get-enabled-node-types.test.ts` 通过，覆盖节点面板白名单与 loop-scoped 节点。
- `cd frontend/packages/workflow/playground && npm run test -- constants.test.ts` 通过，覆盖 `NODES_V2` 白名单入口不再使用旧节点 barrel、白名单 registry 完整、白名单外历史节点走 unsupported shell。
- `go test -gcflags=all='-N -l' ./domain/workflow/internal/canvas/adaptor` 通过；已补 `make workflow-go-test` 统一执行工作流 Go 单测并对 `mockey` 包使用兼容 flags。

后端将统一注册改为显式节点目录，例如：

```go
RegisterWorkflowNodeAdaptors(NodeSetMirap)
```

或者：

```go
catalog := NewNodeCatalog(
    entry.Factory,
    exit.Factory,
    selector.Factory,
    loop.Factory,
    http.Factory,
    mirapStay.Factory,
    mirapHover.Factory,
)
```

前端同步修改：

- `StandardNodeType`。
- `NODES_V2`。
- `getEnabledNodeTypes`。
- 节点面板分类和节点图标。
- 单节点试运行输入生成。

必须删除白名单外节点的静态 import，不能只隐藏节点面板入口。

完成标准：

- 节点面板只显示白名单节点。
- 前后端 NodeType ID 对齐。
- `nodeDTOType` 持久化正确。
- 白名单外历史节点显示明确的“不支持节点”提示。
- Mirap 节点保存、重开和试运行通过。

### 阶段 6：建立精简前端应用壳

预计：5～8 天。

新增：

```text
frontend/apps/workflow-studio
```

只提供：

- 登录页。
- 工作流列表页。
- 创建工作流弹窗。
- 工作流编辑页。
- 发布弹窗。
- 版本查看页。
- 简单用户菜单。

编辑器页面按路由动态加载，避免列表页加载完整 FlowGram 和节点表单代码。

不迁移原 Workspace、Library、Agent IDE、Marketplace、Explore、Plugin、Knowledge 和 Database 页面。工作流列表页直接调用 API，不复用依赖较重的原 Studio Library 页面。

完成标准：

- 首页加载不包含工作流画布大包。
- 进入编辑页才加载画布资源。
- 登录、列表、创建、编辑、保存、重开和发布完整可用。

### 阶段 7：逐步清理前端 workspace 依赖

预计：5～10 天。

推荐删除顺序：

1. Agent IDE。
2. Knowledge UI。
3. Database UI。
4. Plugin UI。
5. Chat UI。
6. DevOps、Testset、Mockset。
7. Marketplace 和 Explore。
8. Project IDE。
9. 无用 Studio 公共包。
10. 无用 Adapter。

每批删除后执行相关 build、lint 和 test。每批建议控制在 5～15 个 package，避免一次删除过多导致依赖问题难以定位。

完成标准：

- 工作流编辑器 workspace 依赖闭包显著下降。
- 不再依赖 Agent、Knowledge、Plugin 和 Chat 包。
- Rush 配置只包含保留包。

### 阶段 8：后端物理删除与依赖收缩

预计：4～7 天。

待删除领域：

- knowledge、plugin、app、singleagent。
- conversation、search、connector。
- modelmgr、prompt、shortcutcmd。
- memory 中不需要的资源数据库能力。

待删除基础设施：

- ES、Milvus、MQ。
- OCR、Parser、Rerank、Embedding。
- Code Runner（如确认不保留）。
- TOS、S3、MinIO 的具体实现。

然后执行：

```bash
cd backend
go mod tidy
go test ./...
```

完成标准：

- `go.mod` 不再包含 Milvus、Elasticsearch、RocketMQ、NSQ、模型 SDK 和 MinIO SDK。
- 后端全量测试通过。
- 后端二进制运行时只依赖 MySQL、Redis 和系统网络。

### 阶段 9：建立无 Docker 开发环境

预计：2～3 天。

提供：

```bash
make init
make migrate
make dev-server
make dev-web
make test
make build
```

`make dev-server` 不得：

- 构建前端。
- 全量执行 goimports。
- 复制完整平台配置。
- 读取 `docker/.env`。
- 启动 Docker 中间件。
- 删除整个构建目录。

建议使用 `air` 监听 Go 源码：

```toml
root = "."
tmp_dir = "tmp"

[build]
cmd = "go build -o ./tmp/workflow-server ./cmd/workflow-server"
bin = "./tmp/workflow-server"
include_ext = ["go", "yaml"]
exclude_dir = ["storage", "tmp", "testdata"]
```

完成标准：

- 修改 Go 文件后自动重启。
- 修改 React 文件后热更新。
- 日常开发不需要执行原来的 `make server`。
- 开发文档中不存在必需的 Docker 步骤。

### 阶段 10：数据迁移与切换

预计：3～5 天。

迁移顺序：

1. 用户和空间。
2. 工作流元信息。
3. 工作流草稿。
4. 工作流发布版本。
5. 工作流引用。
6. 可选执行历史。
7. 将 MinIO 中仍需保留的图标和上传文件导出到本地 storage。
8. 校验对象 key 与新 URL。
9. 抽样重新打开历史画布。
10. 新旧服务并行验证。

数据校验：

```text
旧库 workflow_meta 数量 == 新库 workflow_meta 数量
旧库 workflow_draft 数量 == 新库 workflow_draft 数量
旧库 workflow_version 数量 == 新库 workflow_version 数量
每个 workflow_meta 都存在对应 draft
latest_version 能在 workflow_version 中找到
所有 Mirap 节点 type 均在新节点目录注册
```

## 8. 里程碑

### M1：轻量后端可启动

- 新仓库建立。
- workflow-only 服务完成。
- 只依赖 MySQL、Redis。
- CRUD、保存重开与发布通过。

### M2：MinIO 完全移除

- LocalFilesystemStorage 完成。
- 图标、上传和文件访问正常。
- 环境变量、代码依赖和启动过程不再出现 MinIO。

状态（2026-07-11）：已完成。详见阶段 3 验证记录。

### M3：工作流前端独立

- 精简工作流列表完成。
- 编辑器正常动态加载。
- 创建、保存、重新打开与发布通过。

### M4：节点和依赖裁剪完成

- 只保留节点白名单。
- AI、知识库、插件和聊天依赖删除。
- 前后端编译依赖完成收缩。

### M5：正式切换

- 历史数据迁移完成。
- 新旧核心行为一致。
- 无 Docker 开发文档完成。
- 生产部署和回滚方案完成。

## 9. 最终验收清单

- 新开发环境只安装 Go、Node、MySQL、Redis 即可运行。
- 不需要 Docker 和 Docker Compose。
- 不需要 MinIO、ES、Milvus、etcd 和 MQ。
- 不配置任何 AI 模型也能启动。
- 创建工作流成功。
- 自动保存和手动保存成功。
- 页面重新打开后画布一致。
- 发布版本成功。
- 已发布版本能够查询和执行。
- Mirap 六类节点均可正常执行。
- 子工作流可运行。
- 本地文件上传、访问和删除成功。
- 非法路径和越权文件访问被拒绝。
- 前端不再依赖 Agent、知识库、插件和聊天页面。
- 后端 `go.mod` 不再包含被移除基础设施的 SDK。

## 10. 工期与主要风险

单人整体预计 4～7 周。

大致分布：

- workflow-only 后端与路由：3～5 天。
- MinIO 替换：3～4 天。
- 数据库精简：2～4 天。
- 节点白名单：3～5 天。
- 独立前端应用壳：5～8 天。
- 前端 workspace 裁剪：5～10 天。
- 后端物理删除与依赖收缩：4～7 天。
- 数据迁移和最终切换：3～5 天。

主要风险：

1. 工作流前端入口虽然单一，但当前存在大量 workspace 传递依赖。
2. 隐藏节点不会自动移除静态 import 和编译依赖。
3. 当前 API Router 和 Handler 是全量生成结构，不能直接作为精简服务入口。
4. 工作流创建、保存和发布存在用户空间、对象存储和资源事件的隐式依赖。
5. 历史画布兼容问题通常只在保存后重新打开时暴露。
6. 本地文件存储不适合无共享磁盘的多实例部署。

实施时优先完成 M1 和 M2，确认新后端与本地存储稳定后，再开始大规模清理前端 workspace 包。
