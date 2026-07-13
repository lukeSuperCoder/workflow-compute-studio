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
