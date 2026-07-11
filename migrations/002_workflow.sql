SET NAMES utf8mb4;

-- -----------------------------------------------------------------------
-- workflow_meta
-- -----------------------------------------------------------------------
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
) ENGINE=InnoDB CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'The workflow metadata table,used to record the basic metadata of workflow';

-- -----------------------------------------------------------------------
-- workflow_draft
-- -----------------------------------------------------------------------
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

-- -----------------------------------------------------------------------
-- workflow_version
-- -----------------------------------------------------------------------
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

-- -----------------------------------------------------------------------
-- workflow_reference
-- -----------------------------------------------------------------------
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
