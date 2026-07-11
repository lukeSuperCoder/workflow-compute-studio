.PHONY: debug fe server sync_db dump_db middleware web down clean python help workflow-env workflow-middleware workflow-migrate workflow-server workflow-smoke workflow-down

# 定义脚本路径
SCRIPTS_DIR := ./scripts
BUILD_FE_SCRIPT := $(SCRIPTS_DIR)/build_fe.sh
BUILD_SERVER_SCRIPT := $(SCRIPTS_DIR)/setup/server.sh
SYNC_DB_SCRIPT := $(SCRIPTS_DIR)/setup/db_migrate_apply.sh
DUMP_DB_SCRIPT := $(SCRIPTS_DIR)/setup/db_migrate_dump.sh
SETUP_DOCKER_SCRIPT := $(SCRIPTS_DIR)/setup/docker.sh
SETUP_PYTHON_SCRIPT := $(SCRIPTS_DIR)/setup/python.sh
COMPOSE_FILE := docker/docker-compose-debug.yml
OCEANBASE_COMPOSE_FILE := docker/docker-compose-oceanbase.yml
OCEANBASE_DEBUG_COMPOSE_FILE := docker/docker-compose-oceanbase_debug.yml
MYSQL_SCHEMA := ./docker/volumes/mysql/schema.sql
MYSQL_INIT_SQL := ./docker/volumes/mysql/sql_init.sql
ENV_FILE := ./docker/.env.debug
WEB_ENV_FILE := ./docker/.env
OCEANBASE_ENV_FILE := ./docker/.env.debug
WORKFLOW_COMPOSE_FILE := docker/docker-compose-workflow.yml
WORKFLOW_DOCKER_ENV_FILE := ./docker/.env.workflow
WORKFLOW_BACKEND_ENV_FILE := ./backend/.env.workflow
STATIC_DIR := ./bin/resources/static
ES_INDEX_SCHEMA := ./docker/volumes/elasticsearch/es_index_schema
ES_SETUP_SCRIPT := ./docker/volumes/elasticsearch/setup_es.sh

debug: env middleware python server

env:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "Env file '$(ENV_FILE)' not found, using example env..."; \
		cp ./docker/.env.debug.example $(ENV_FILE); \
	fi

fe:
	@echo "Building frontend..."
	@bash $(BUILD_FE_SCRIPT)

server: env
	@if [ ! -d "$(STATIC_DIR)" ]; then \
		echo "Static directory '$(STATIC_DIR)' not found, building frontend..."; \
		$(MAKE) fe; \
	fi
	@echo "Building and run server..."
	@APP_ENV=debug bash $(BUILD_SERVER_SCRIPT) -start


build_server:
	@echo "Building server..."
	@bash $(BUILD_SERVER_SCRIPT)

sync_db: env
	@echo "Syncing database..."
	@docker compose -f $(COMPOSE_FILE) --env-file $(ENV_FILE) --profile mysql-setup up -d

dump_db: env dump_sql_schema
	@echo "Dumping database..."
	@. $(ENV_FILE); \
	bash $(DUMP_DB_SCRIPT)

sql_init:
	@echo "Init sql data..."
	@docker compose -f $(COMPOSE_FILE) --env-file $(ENV_FILE) --profile mysql-setup up -d

middleware:
	@echo "Start middleware docker environment for opencoze app"
	@docker compose -f $(COMPOSE_FILE) --env-file $(ENV_FILE) --profile middleware up -d --wait

build_docker:
	@echo "Build docker image"
	@docker compose -f $(COMPOSE_FILE) --profile build-server build

web_env:
	@if [ ! -f "$(WEB_ENV_FILE)" ]; then \
		echo "Env file '$(WEB_ENV_FILE)' not found, using example env..."; \
		cp ./docker/.env.example $(WEB_ENV_FILE); \
	fi

web: web_env
	@echo "Start web server in docker"
	@docker compose -f docker/docker-compose.yml --env-file $(WEB_ENV_FILE) up -d

down_web:
	@echo "Stop web server in docker"
	@docker compose -f docker/docker-compose.yml --env-file $(WEB_ENV_FILE) down

down: env
	@echo "Stop all docker containers"
	@docker compose -f $(COMPOSE_FILE) --profile '*' down

clean: down
	@echo "Remove docker containers and volumes data"
	@rm -rf ./docker/data

python:
	@echo "Setting up Python..."
	@bash $(SETUP_PYTHON_SCRIPT)

dump_sql_schema:
	@echo "Dumping mysql schema to $(MYSQL_SCHEMA)..."
	@. $(ENV_FILE); \
	{ echo "SET NAMES utf8mb4;\nCREATE DATABASE IF NOT EXISTS opencoze COLLATE utf8mb4_unicode_ci;"; atlas schema inspect -u $$ATLAS_URL --format "{{ sql . }}" --exclude "atlas_schema_revisions,table_*" | sed 's/CREATE TABLE/CREATE TABLE IF NOT EXISTS/g'; } > $(MYSQL_SCHEMA)
		@sed -i.bak -E 's/(\))[[:space:]]+CHARSET utf8mb4/\1 ENGINE=InnoDB CHARSET utf8mb4/' $(MYSQL_SCHEMA) && rm -f $(MYSQL_SCHEMA).bak
		@sed -i.bak "s/\"/'/g" $(MYSQL_SCHEMA) && rm -f $(MYSQL_SCHEMA).bak
	@cat $(MYSQL_INIT_SQL) >> $(MYSQL_SCHEMA)
	@echo "Dumping mysql schema to helm/charts/opencoze/files/mysql ..."
	@cp $(MYSQL_SCHEMA) ./helm/charts/opencoze/files/mysql/

atlas-hash:
	@echo "Rehash atlas migration files..."
	@(cd ./docker/atlas && atlas migrate hash)

setup_es_index:
	@echo "Setting up Elasticsearch index..."
	@. $(ENV_FILE); \
	bash $(ES_SETUP_SCRIPT) --index-dir $(ES_INDEX_SCHEMA) --docker-host false --es-address "$$ES_ADDR"

oceanbase_env:
	@bash scripts/setup/oceanbase_env.sh debug

oceanbase_debug: oceanbase_env oceanbase_middleware_debug python oceanbase_server_debug

oceanbase_middleware_debug:
	@echo "Starting OceanBase debug middleware..."
	@docker compose -f $(OCEANBASE_DEBUG_COMPOSE_FILE) --env-file $(ENV_FILE) --profile middleware up -d --wait

oceanbase_server_debug:
	@if [ ! -d "$(STATIC_DIR)" ]; then \
		echo "Static directory '$(STATIC_DIR)' not found, building frontend..."; \
		$(MAKE) fe; \
	fi
	@echo "Building and run OceanBase debug server..."
	@APP_ENV=debug bash $(BUILD_SERVER_SCRIPT) -start

workflow-env:
	@if [ ! -f "$(WORKFLOW_DOCKER_ENV_FILE)" ]; then \
		echo "Env file '$(WORKFLOW_DOCKER_ENV_FILE)' not found, using example env..."; \
		cp ./docker/.env.workflow.example $(WORKFLOW_DOCKER_ENV_FILE); \
	fi
	@if [ ! -f "$(WORKFLOW_BACKEND_ENV_FILE)" ]; then \
		echo "Env file '$(WORKFLOW_BACKEND_ENV_FILE)' not found, using example env..."; \
		cp ./backend/.env.workflow.example $(WORKFLOW_BACKEND_ENV_FILE); \
	fi

workflow-middleware: workflow-env
	@echo "Start isolated Mirap workflow MySQL and Redis"
	@docker compose -f $(WORKFLOW_COMPOSE_FILE) --env-file $(WORKFLOW_DOCKER_ENV_FILE) up -d --wait

workflow-migrate: workflow-env
	@echo "Apply workflow database migrations"
	@scripts/workflow_migrate.sh

workflow-server: workflow-env
	@echo "Start workflow-only backend server"
	@cd backend && APP_ENV=workflow go run ./cmd/workflow-server

workflow-smoke: workflow-env
	@echo "Run workflow-only API smoke test"
	@scripts/workflow_smoke_test.sh

workflow-go-test:
	@echo "Run workflow Go tests"
	@cd backend && go test ./application/workflow ./domain/workflow/entity ./domain/workflow/service
	@cd backend && go test -gcflags=all='-N -l' ./domain/workflow/internal/canvas/adaptor

workflow-down: workflow-env
	@echo "Stop isolated Mirap workflow middleware"
	@docker compose -f $(WORKFLOW_COMPOSE_FILE) --env-file $(WORKFLOW_DOCKER_ENV_FILE) down

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  debug            - Start the debug environment."
	@echo "  env              - Setup env file."
	@echo "  fe               - Build the frontend."
	@echo "  server           - Build and run the server binary."
	@echo "  build_server     - Build the server binary."
	@echo "  sync_db          - Sync opencoze_latest_schema.hcl to the database."
	@echo "  dump_db          - Dump the database to opencoze_latest_schema.hcl and migrations files."
	@echo "  sql_init         - Init sql data..."
	@echo "  dump_sql_schema  - Dump the database schema to sql file."
	@echo "  middleware       - Setup middlewares docker environment, but exclude the server app."
	@echo "  web              - Setup web docker environment, include middlewares docker."
	@echo "  down             - Stop the docker containers."
	@echo "  down_web         - Stop the web docker containers."
	@echo "  clean            - Stop the docker containers and clean volumes."
	@echo "  python           - Setup python environment."
	@echo "  atlas-hash       - Rehash atlas migration files."
	@echo "  setup_es_index   - Setup elasticsearch index."
	@echo "  workflow-env     - Create isolated workflow env files."
	@echo "  workflow-middleware - Start isolated workflow MySQL and Redis."
	@echo "  workflow-migrate - Apply workflow database migrations to the running MySQL container."
	@echo "  workflow-server  - Start workflow-only backend with APP_ENV=workflow."
	@echo "  workflow-smoke   - Run workflow-only API smoke test against LISTEN_ADDR."
	@echo "  workflow-go-test - Run workflow Go unit tests with mockey-compatible flags."
	@echo "  workflow-down    - Stop isolated workflow MySQL and Redis."
	@echo ""
	@echo "OceanBase Commands:"
	@echo "  oceanbase_env    - Setup OceanBase environment file (like 'env')."
	@echo "  oceanbase_debug  - Start OceanBase debug environment (like 'debug')."
	@echo ""
	@echo "  help             - Show this help message."
