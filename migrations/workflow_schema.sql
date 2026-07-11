-- Mirap Workflow Studio - Combined Schema
-- This file concatenates all migration files for Docker entrypoint-initdb.
-- Keep it in sync with: 001_account.sql, 002_workflow.sql, 003_execution.sql, 004_upload.sql.
SET NAMES utf8mb4;

-- ===================== 001_account.sql =====================
CREATE TABLE IF NOT EXISTS `user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary Key ID',
  `name` varchar(128) NOT NULL DEFAULT '' COMMENT 'User Nickname',
  `unique_name` varchar(128) NOT NULL DEFAULT '' COMMENT 'User Unique Name',
  `email` varchar(128) NOT NULL DEFAULT '' COMMENT 'Email',
  `password` varchar(128) NOT NULL DEFAULT '' COMMENT 'Password (Encrypted)',
  `description` varchar(512) NOT NULL DEFAULT '' COMMENT 'User Description',
  `icon_uri` varchar(512) NOT NULL DEFAULT '' COMMENT 'Avatar URI',
  `user_verified` bool NOT NULL DEFAULT 0 COMMENT 'User Verification Status',
  `locale` varchar(128) NOT NULL DEFAULT '' COMMENT 'Locale',
  `session_key` varchar(256) NOT NULL DEFAULT '' COMMENT 'Session Key',
  `created_at` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Creation Time (Milliseconds)',
  `updated_at` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Update Time (Milliseconds)',
  `deleted_at` bigint unsigned NULL COMMENT 'Deletion Time (Milliseconds)',
  PRIMARY KEY (`id`),
  INDEX `idx_session_key` (`session_key`),
  UNIQUE INDEX `uniq_email` (`email`),
  UNIQUE INDEX `uniq_unique_name` (`unique_name`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'User Table';

CREATE TABLE IF NOT EXISTS `space` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary Key ID, Space ID',
  `owner_id` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Owner ID',
  `name` varchar(200) NOT NULL DEFAULT '' COMMENT 'Space Name',
  `description` varchar(2000) NOT NULL DEFAULT '' COMMENT 'Space Description',
  `icon_uri` varchar(200) NOT NULL DEFAULT '' COMMENT 'Icon URI',
  `creator_id` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Creator ID',
  `created_at` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Creation Time (Milliseconds)',
  `updated_at` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Update Time (Milliseconds)',
  `deleted_at` bigint unsigned NULL COMMENT 'Deletion Time (Milliseconds)',
  PRIMARY KEY (`id`),
  INDEX `idx_creator_id` (`creator_id`),
  INDEX `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Space Table';

CREATE TABLE IF NOT EXISTS `space_user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary Key ID, Auto Increment',
  `space_id` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Space ID',
  `user_id` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'User ID',
  `role_type` int NOT NULL DEFAULT 3 COMMENT 'Role Type: 1.owner 2.admin 3.member',
  `created_at` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Creation Time (Milliseconds)',
  `updated_at` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Update Time (Milliseconds)',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  UNIQUE INDEX `uniq_space_user` (`space_id`, `user_id`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Space Member Table';

-- ===================== 002_workflow.sql =====================
CREATE TABLE IF NOT EXISTS `workflow_meta` (
  `id` bigint unsigned NOT NULL COMMENT 'workflow id',
  `name` varchar(256) NOT NULL COMMENT 'workflow name',
  `description` varchar(2000) NOT NULL COMMENT 'workflow description',
  `icon_uri` varchar(256) NOT NULL COMMENT 'icon uri',
  `status` tinyint unsigned NOT NULL COMMENT '0: Not published, 1: Published',
  `content_type` tinyint unsigned NOT NULL COMMENT '0 Users 1 Official',
  `mode` tinyint unsigned NOT NULL COMMENT '0:workflow, 3:chat_flow',
  `created_at` bigint unsigned NOT NULL COMMENT 'create time in millisecond',
  `updated_at` bigint unsigned NULL COMMENT 'update time in millisecond',
  `deleted_at` datetime(3) NULL COMMENT 'delete time in millisecond',
  `creator_id` bigint unsigned NOT NULL COMMENT 'user id for creator',
  `tag` tinyint unsigned NULL COMMENT 'template tag',
  `author_id` bigint unsigned NOT NULL COMMENT 'Original author user ID',
  `space_id` bigint unsigned NOT NULL COMMENT 'space id',
  `updater_id` bigint unsigned NULL COMMENT 'User ID for updating metadata',
  `source_id` bigint unsigned NULL COMMENT 'Workflow ID of source',
  `app_id` bigint unsigned NULL COMMENT 'app id',
  `latest_version` varchar(50) NULL COMMENT 'the version of the most recent publish',
  `latest_version_ts` bigint unsigned NULL COMMENT 'create time of latest version',
  PRIMARY KEY (`id`),
  INDEX `idx_app_id` (`app_id`),
  INDEX `idx_latest_version_ts` (`latest_version_ts` DESC),
  INDEX `idx_space_id_app_id_status_latest_version_ts` (`space_id`, `app_id`, `status`, `latest_version_ts`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'The workflow metadata table';

CREATE TABLE IF NOT EXISTS `workflow_draft` (
  `id` bigint unsigned NOT NULL COMMENT 'workflow ID',
  `canvas` mediumtext NULL COMMENT 'Front end schema',
  `input_params` mediumtext NULL COMMENT 'Input schema',
  `output_params` mediumtext NULL COMMENT 'Output parameter schema',
  `test_run_success` bool NOT NULL DEFAULT 0 COMMENT '0 not running, 1 running successfully',
  `modified` bool NOT NULL DEFAULT 0 COMMENT '0 has not been modified, 1 has been modified',
  `updated_at` bigint unsigned NULL COMMENT 'Update Time in Milliseconds',
  `deleted_at` datetime(3) NULL COMMENT 'Delete Time',
  `commit_id` varchar(255) NOT NULL COMMENT 'used to uniquely identify a draft snapshot',
  PRIMARY KEY (`id`),
  INDEX `idx_updated_at` (`updated_at` DESC)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Workflow canvas draft table';

CREATE TABLE IF NOT EXISTS `workflow_version` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `workflow_id` bigint unsigned NOT NULL COMMENT 'workflow id',
  `version` varchar(50) NOT NULL COMMENT 'Published version',
  `version_description` varchar(2000) NOT NULL COMMENT 'Version Description',
  `canvas` mediumtext NULL COMMENT 'Front end schema',
  `input_params` mediumtext NULL COMMENT 'input params',
  `output_params` mediumtext NULL COMMENT 'output params',
  `creator_id` bigint unsigned NOT NULL COMMENT 'creator id',
  `created_at` bigint unsigned NOT NULL COMMENT 'Create Time in Milliseconds',
  `deleted_at` datetime(3) NULL COMMENT 'Delete Time',
  `commit_id` varchar(255) NOT NULL COMMENT 'the commit id corresponding to this version',
  PRIMARY KEY (`id`),
  INDEX `idx_id_created_at` (`workflow_id`, `created_at`),
  UNIQUE INDEX `uniq_workflow_id_version` (`workflow_id`, `version`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Workflow Canvas Version Information Table';

CREATE TABLE IF NOT EXISTS `workflow_reference` (
  `id` bigint unsigned NOT NULL COMMENT 'workflow id',
  `referred_id` bigint unsigned NOT NULL COMMENT 'the id of the workflow that is referred by other entities',
  `referring_id` bigint unsigned NOT NULL COMMENT 'the entity id that refers this workflow',
  `refer_type` tinyint unsigned NOT NULL COMMENT '1 subworkflow 2 tool',
  `referring_biz_type` tinyint unsigned NOT NULL COMMENT 'the biz type the referring entity belongs to: 1. workflow 2. agent',
  `created_at` bigint unsigned NOT NULL COMMENT 'create time in millisecond',
  `status` tinyint unsigned NOT NULL COMMENT 'whether this reference currently takes effect. 0: disabled 1: enabled',
  `deleted_at` datetime(3) NULL COMMENT 'Delete Time',
  PRIMARY KEY (`id`),
  INDEX `idx_referred_id_referring_biz_type_status` (`referred_id`, `referring_biz_type`, `status`),
  INDEX `idx_referring_id_status` (`referring_id`, `status`),
  UNIQUE INDEX `uniq_referred_id_referring_id_refer_type` (`referred_id`, `referring_id`, `refer_type`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'The workflow association table';

-- ===================== 003_execution.sql =====================
CREATE TABLE IF NOT EXISTS `workflow_execution` (
  `id` bigint unsigned NOT NULL COMMENT 'execute id',
  `workflow_id` bigint unsigned NOT NULL COMMENT 'workflow_id',
  `version` varchar(50) NULL COMMENT 'workflow version. empty if is draft',
  `space_id` bigint unsigned NOT NULL COMMENT 'the space id the workflow belongs to',
  `mode` tinyint unsigned NOT NULL COMMENT 'the execution mode: 1. debug run 2. release run 3. node debug',
  `operator_id` bigint unsigned NOT NULL COMMENT 'the user id that runs this workflow',
  `connector_id` bigint unsigned NULL COMMENT 'the connector on which this execution happened',
  `connector_uid` varchar(64) NULL COMMENT 'user id of the connector',
  `created_at` bigint unsigned NOT NULL COMMENT 'create time in millisecond',
  `log_id` varchar(128) NULL COMMENT 'log id',
  `status` tinyint unsigned NULL COMMENT '1=running 2=success 3=fail 4=interrupted',
  `duration` bigint unsigned NULL COMMENT 'execution duration in millisecond',
  `input` mediumtext NULL COMMENT 'actual input of this execution',
  `output` mediumtext NULL COMMENT 'the actual output of this execution',
  `error_code` varchar(255) NULL COMMENT 'error code if any',
  `fail_reason` mediumtext NULL COMMENT 'the reason for failure',
  `input_tokens` bigint unsigned NULL COMMENT 'number of input tokens',
  `output_tokens` bigint unsigned NULL COMMENT 'number of output tokens',
  `updated_at` bigint unsigned NULL COMMENT 'update time in millisecond',
  `root_execution_id` bigint unsigned NULL COMMENT 'the top level execution id. Null if this is the root',
  `parent_node_id` varchar(128) NULL COMMENT 'the node key for the sub_workflow node that executes this workflow',
  `app_id` bigint unsigned NULL COMMENT 'app id this workflow execution belongs to',
  `node_count` mediumint unsigned NULL COMMENT 'the total node count of the workflow',
  `resume_event_id` bigint unsigned NULL COMMENT 'the current event ID which is resuming',
  `agent_id` bigint unsigned NULL COMMENT 'the agent that this execution binds to',
  `sync_pattern` tinyint unsigned NULL COMMENT 'the sync pattern 1. sync 2. async 3. stream',
  `commit_id` varchar(255) NULL COMMENT 'draft commit id this execution belongs to',
  PRIMARY KEY (`id`),
  INDEX `idx_workflow_id_version_mode_created_at` (`workflow_id`, `version`, `mode`, `created_at`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Workflow Execution Record Table';

CREATE TABLE IF NOT EXISTS `node_execution` (
  `id` bigint unsigned NOT NULL COMMENT 'node execution id',
  `execute_id` bigint unsigned NOT NULL COMMENT 'the workflow execute id this node execution belongs to',
  `node_id` varchar(128) NOT NULL COMMENT 'node key',
  `node_name` varchar(128) NOT NULL COMMENT 'name of the node',
  `node_type` varchar(128) NOT NULL COMMENT 'the type of the node, in string',
  `created_at` bigint unsigned NOT NULL COMMENT 'create time in millisecond',
  `status` tinyint unsigned NOT NULL COMMENT '1=waiting 2=running 3=success 4=fail',
  `duration` bigint unsigned NULL COMMENT 'execution duration in millisecond',
  `input` mediumtext NULL COMMENT 'actual input of the node',
  `output` mediumtext NULL COMMENT 'actual output of the node',
  `raw_output` mediumtext NULL COMMENT 'the original output of the node',
  `error_info` mediumtext NULL COMMENT 'error info',
  `error_level` varchar(32) NULL COMMENT 'level of the error',
  `input_tokens` bigint unsigned NULL COMMENT 'number of input tokens',
  `output_tokens` bigint unsigned NULL COMMENT 'number of output tokens',
  `updated_at` bigint unsigned NULL COMMENT 'update time in millisecond',
  `composite_node_index` bigint unsigned NULL COMMENT 'loop or batch_s execution index',
  `composite_node_items` mediumtext NULL COMMENT 'the items extracted from parent composite node for this index',
  `parent_node_id` varchar(128) NULL COMMENT 'when as inner node for loop or batch, this is the parent node_s key',
  `sub_execute_id` bigint unsigned NULL COMMENT 'if this node is sub_workflow, the exe id of the sub workflow',
  `extra` mediumtext NULL COMMENT 'extra info',
  PRIMARY KEY (`id`),
  INDEX `idx_execute_id_node_id` (`execute_id`, `node_id`),
  INDEX `idx_execute_id_parent_node_id` (`execute_id`, `parent_node_id`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Node run record';

CREATE TABLE IF NOT EXISTS `workflow_snapshot` (
  `workflow_id` bigint unsigned NOT NULL COMMENT 'workflow id this snapshot belongs to',
  `commit_id` varchar(255) NOT NULL COMMENT 'the commit id of the workflow draft',
  `canvas` mediumtext NULL COMMENT 'frontend schema for this snapshot',
  `input_params` mediumtext NULL COMMENT 'input parameter info',
  `output_params` mediumtext NULL COMMENT 'output parameter info',
  `created_at` bigint unsigned NOT NULL COMMENT 'Create Time in Milliseconds',
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_workflow_id_commit_id` (`workflow_id`, `commit_id`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'snapshot for executed workflow draft';

-- ===================== 004_upload.sql =====================
CREATE TABLE IF NOT EXISTS `files` (
  `id` bigint unsigned NOT NULL COMMENT 'id',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT 'file name',
  `file_size` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'file size',
  `tos_uri` varchar(1024) NOT NULL DEFAULT '' COMMENT 'file storage URI',
  `status` tinyint unsigned NOT NULL DEFAULT 0 COMMENT 'status: 0 invalid, 1 valid',
  `comment` varchar(1024) NOT NULL DEFAULT '' COMMENT 'file comment',
  `source` tinyint unsigned NOT NULL DEFAULT 0 COMMENT 'source: 1 from API',
  `creator_id` varchar(512) NOT NULL DEFAULT '' COMMENT 'creator id',
  `content_type` varchar(255) NOT NULL DEFAULT '' COMMENT 'content type',
  `coze_account_id` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'coze account id',
  `created_at` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Create Time in Milliseconds',
  `updated_at` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Update Time in Milliseconds',
  `deleted_at` datetime(3) NULL COMMENT 'Delete Time',
  PRIMARY KEY (`id`),
  INDEX `idx_creator_id` (`creator_id`)
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'file resource table';
