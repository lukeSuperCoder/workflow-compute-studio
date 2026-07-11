SET NAMES utf8mb4;

-- -----------------------------------------------------------------------
-- user
-- -----------------------------------------------------------------------
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

-- -----------------------------------------------------------------------
-- space
-- -----------------------------------------------------------------------
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

-- -----------------------------------------------------------------------
-- space_user
-- -----------------------------------------------------------------------
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
