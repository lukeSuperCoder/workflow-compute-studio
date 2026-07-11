SET NAMES utf8mb4;

-- -----------------------------------------------------------------------
-- workflow_execution
-- -----------------------------------------------------------------------
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

-- -----------------------------------------------------------------------
-- node_execution
-- -----------------------------------------------------------------------
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

-- -----------------------------------------------------------------------
-- workflow_snapshot
-- -----------------------------------------------------------------------
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
