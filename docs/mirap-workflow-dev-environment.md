# Mirap Workflow 轻量开发环境

## 目标

本地开发只使用 Docker 承载 MySQL 和 Redis，不启动 Coze 全量 Docker Compose，也不需要 MinIO、Elasticsearch、Milvus、etcd 或 MQ 容器。

## 常用命令

```bash
make workflow-env
make workflow-middleware
make workflow-migrate
make dev-server
make dev-web
make workflow-smoke
make test
make build
```

- `workflow-env`：生成 `docker/.env.workflow` 和 `backend/.env.workflow`。
- `workflow-middleware`：启动 `mirap-workflow-mysql` 和 `mirap-workflow-redis`。
- `workflow-migrate`：执行 workflow-only schema/migration。
- `dev-server`：启动 workflow-only 后端，默认监听 `:8889`。
- `dev-web`：启动 workflow 前端，默认监听 `:5174`。
- `workflow-smoke`：验证 health、文件上传/读取/删除、工作流创建/保存/重开/发布/执行。
- `test`：运行 workflow Go 测试。
- `build`：构建 `bin/workflow-server`。

## 端口和数据目录

| 服务 | 容器 | 本地端口 | 数据目录 |
| --- | --- | --- | --- |
| MySQL | `mirap-workflow-mysql` | `3307` | `docker/data-workflow/mysql` |
| Redis | `mirap-workflow-redis` | `6380` | `docker/data-workflow/redis` |
| 后端 | 本机进程 | `8889` | `storage` |
| 前端 | 本机进程 | `5174` | 无 |

## 备份与恢复

推荐用 SQL dump 备份 MySQL 数据：

```bash
docker compose -f docker/docker-compose-workflow.yml --env-file docker/.env.workflow \
  exec -T workflow-mysql mysqldump -umirap -pmirap123 mirap_workflow \
  > /tmp/mirap_workflow_backup.sql
```

恢复到已启动的 workflow MySQL：

```bash
docker compose -f docker/docker-compose-workflow.yml --env-file docker/.env.workflow \
  exec -T workflow-mysql mysql -umirap -pmirap123 mirap_workflow \
  < /tmp/mirap_workflow_backup.sql
```

Redis 当前只作为缓存和 checkpoint 存储使用。需要保留 Redis 状态时，先停止写入，再备份 `docker/data-workflow/redis` 目录。

## 空库重建

谨慎执行，先确认已备份：

```bash
make workflow-down
rm -rf docker/data-workflow/mysql docker/data-workflow/redis
make workflow-middleware
make workflow-migrate
make workflow-smoke
```

## 历史数据切换

阶段 10 使用带运行清单和回滚备份的覆盖式切换。源端默认是
`coze-studio-debug` 的 `coze-mysql`、`coze-minio` 和 `opencoze` 库；目标端读取
`docker/.env.workflow`。执行记录、节点执行记录和快照不会迁移。

工作流迁移集只包含同时满足以下条件的数据：创建者存在、所属空间存在，并且创建者是
该空间成员。预检会把纳入和排除的工作流 ID 分别写入 `included_workflow_ids` 和
`excluded_workflow_ids`。孤立测试工作流不会进入元信息、草稿、版本、引用或文件清单。

```bash
# 只读预检，并从输出取得 RUN_ID
make workflow-cutover-preflight

# 清库前必须成功生成源数据、目标数据和 local storage 备份
make workflow-cutover-backup RUN_ID=<run-id>

# 覆盖目标业务数据并迁移被引用的 MinIO 对象
make workflow-cutover-migrate RUN_ID=<run-id>
make workflow-cutover-validate RUN_ID=<run-id>

# 验证失败时恢复切换前的目标数据库和 storage
make workflow-cutover-rollback RUN_ID=<run-id>
```

运行产物保存在 `backups/workflow-cutover/<run-id>/`（Git 忽略），包括源数据导出、
目标切换前备份、storage 备份、SHA-256 清单和验证报告。`migrate` 与 `rollback`
均要求明确的运行 ID；脚本还会校验目标库名，避免误操作其他数据库。

MySQL 首次启动会执行 `migrations/workflow_schema.sql`，之后 `workflow-migrate` 会按 `_mirap_schema_migrations` 记录执行增量迁移。

## 常见问题

如果 `dev-server` 提示 `:8889` 被占用：

```bash
lsof -nP -iTCP:8889 -sTCP:LISTEN
kill <PID>
make dev-server
```

如果中间件未 healthy：

```bash
docker compose -f docker/docker-compose-workflow.yml --env-file docker/.env.workflow ps
docker compose -f docker/docker-compose-workflow.yml --env-file docker/.env.workflow logs workflow-mysql
docker compose -f docker/docker-compose-workflow.yml --env-file docker/.env.workflow logs workflow-redis
```
