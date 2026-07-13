# Workflow 数据迁移与切换设计

## 目标

将 Docker Compose 项目 `coze-studio-debug` 中 `opencoze` MySQL 数据库的账户、空间和工作流数据迁移到 workflow-only 的 `mirap_workflow` 数据库，并将工作流仍需使用的 MinIO 对象迁移到本地文件存储。目标库现有的阶段验证数据可以删除；迁移完成后，workflow-only 服务成为唯一写入方。

## 已确认范围

迁移以下数据：

- `user`
- `space`
- `space_user`
- `workflow_meta`
- `workflow_draft`
- `workflow_version`
- `workflow_reference`
- 工作流元信息、草稿和发布画布实际引用的图标与上传文件

明确不迁移以下数据：

- `workflow_execution`
- `node_execution`
- `workflow_snapshot`
- 插件图标、Milvus 对象及其他与 workflow-only 无关的 MinIO 对象
- 目标库现有的 smoke/test 工作流

源库盘点基线为 2 个用户、2 个空间、8 个工作流元信息、8 个草稿、13 个发布版本和 1 条工作流引用。每个工作流元信息均有草稿，且所有非空 `latest_version` 均能在发布版本表中找到。源库使用 `utf8mb4` 和 `utf8mb4_unicode_ci`。

## 方案

采用受控覆盖迁移。迁移工具先备份再清空目标业务表，随后从源库逻辑导出并按依赖顺序导入目标库。所有破坏性步骤必须显式确认，默认行为只执行预检。

迁移不依赖源库和目标库处于同一个 MySQL 实例。数据通过带显式表清单的逻辑导出文件传递，便于审计、复跑和恢复。数据库凭据只从容器环境或指定环境文件读取，不写入日志、备份文件名或仓库。

## 组件与职责

### 切换入口

新增阶段 10 专用脚本和 Make 入口。脚本提供以下动作：

- `preflight`：检查容器、数据库、字符集、表结构、源数据一致性、目标备份目录和本地 storage 目录。
- `backup`：分别备份源库选定表、目标库完整业务数据和目标 local storage。
- `migrate`：在显式确认后清空目标业务表，导入源数据并复制所需对象。
- `validate`：执行数据库、画布和文件校验，不修改数据。
- `rollback`：使用本次切换生成的目标库和 storage 备份恢复切换前状态。

每次执行生成唯一的带时间戳运行目录和清单文件，记录源/目标容器、数据库名、备份文件、迁移范围、校验结果与状态。备份和运行产物不提交到 Git。

### 数据库迁移

目标 schema 先通过现有 `workflow_migrate.sh` 初始化到最新版本。清空目标时保留 `_mirap_schema_migrations`，按以下反向依赖顺序清空业务数据：

1. `workflow_reference`
2. `workflow_version`
3. `workflow_draft`
4. `workflow_meta`
5. `space_user`
6. `space`
7. `user`

同时清空不迁移的目标执行历史表，避免旧 smoke 数据残留：`node_execution`、`workflow_snapshot`、`workflow_execution`。目标 `files` 表与 local storage 一并按切换前备份后清理，再按实际迁移文件重建。

导入顺序为：

1. `user`
2. `space`
3. `space_user`
4. `workflow_meta`
5. `workflow_draft`
6. `workflow_version`
7. `workflow_reference`

导出和导入必须使用显式列清单，不能依赖 `SELECT *`。预检逐列比较源、目标的列名、类型、可空性和默认值；不兼容时在清空目标前失败。迁移保留原始 ID、时间戳、软删除标记、版本号和引用关系。

### 文件迁移

从 `workflow_meta.icon_uri` 以及草稿、发布版本画布中提取对象引用，规范化为 MinIO bucket 内的对象 key。只允许读取 `opencoze` bucket，并拒绝路径穿越、绝对路径和 bucket 外引用。

复制对象时保持逻辑 key 不变，写入 workflow-only 配置的 local storage 根目录。若数据库保存的是对象 key，则保持原值；若保存的是旧 MinIO 绝对 URL，则转换为新服务的 `/assets/` 或 `/api/files/` URL 形式，并把映射写入运行清单。复制后校验文件存在、大小一致，并为每个文件记录 SHA-256。

默认图标只复制 8 个迁移工作流实际引用的对象。业务上传只复制被迁移画布或元信息引用的对象。未被引用的 MinIO 对象不会进入目标 storage。

## 切换流程

1. 确认旧服务停止写入；源 MySQL 和 MinIO 可读，目标 MySQL/Redis 健康。
2. 执行目标 schema 迁移和 preflight。
3. 生成源数据导出、目标数据库备份、目标 storage 备份和运行清单。
4. 显式确认运行 ID 后，清空目标业务数据。
5. 导入账户、空间、工作流和引用数据。
6. 复制并校验实际引用的对象。
7. 执行自动数据校验。
8. 启动 workflow-only 服务，执行 API smoke 测试和历史画布抽样重开。
9. 验证通过后保持旧服务停写并记录切换完成；验证失败则停止新服务并执行 rollback。

## 校验与验收

自动校验必须满足：

- 源、目标迁移表的精确行数一致。
- 每个 `workflow_meta` 都存在同 ID 的 `workflow_draft`。
- 每个 `workflow_version.workflow_id` 都能找到对应 `workflow_meta`。
- 每个非空 `workflow_meta.latest_version` 都能匹配同工作流的 `workflow_version.version`。
- 每条工作流引用两端都指向已迁移实体，或被明确识别为允许的外部引用；本次源数据的 workflow-to-workflow 引用必须闭合。
- 草稿和发布画布中的节点类型均属于 workflow-only 节点白名单。
- 每个已迁移文件均存在，大小与 SHA-256 和源对象一致。
- 目标执行历史三张表为空。
- workflow-only API 可完成登录态访问、列表、历史画布重新打开、创建、保存、发布和执行。
- 运行现有 `make workflow-smoke` 通过，并至少人工抽样重开包含六类 Mirap 节点、子工作流和上传文件引用的历史画布。

## 错误处理与安全约束

- `preflight` 或 `backup` 失败时禁止进入清空步骤。
- 清空目标必须同时提供动作参数、运行 ID 和明确确认标志，避免误操作其他数据库。
- 脚本校验目标数据库名为 workflow-only 配置值，并拒绝源、目标指向同一数据库。
- 任一导入或校验失败都以非零状态退出，在运行清单中记录失败阶段，不自动删除备份。
- 密码不通过命令回显或清单持久化；日志不得打印容器完整环境。
- 回滚只接受本次运行生成且校验通过的备份清单，恢复前再次备份当前失败现场。
- 旧库和旧 MinIO 在最终验收完成前保持不删除，作为第二层恢复来源。

## 回滚结果

rollback 恢复切换前的目标业务表、`files` 表和 local storage。恢复后重新运行目标数据计数、文件哈希和 `make workflow-smoke`，确认 9 个原目标验证工作流及其相关状态恢复。回滚不修改旧 `opencoze` 数据库或旧 MinIO 数据。

## 完成定义

阶段 10 只有在迁移运行清单标记成功、所有自动校验通过、历史画布抽样重开通过、workflow smoke 通过且备份恢复步骤已至少演练一次后才能标记完成。执行记录与快照不属于迁移完成标准。
