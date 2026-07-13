/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type Int64Like = number | string;

export interface WorkflowItem {
  workflow_id?: string;
  name?: string;
  desc?: string;
  url?: string;
  icon_uri?: string;
  status?: number;
  create_time?: Int64Like;
  update_time?: Int64Like;
  space_id?: string;
  creator?: {
    id?: string;
    name?: string;
    avatar_url?: string;
    self?: boolean;
  };
}

export interface ReleasedWorkflowItem {
  workflow_id?: string;
  space_id?: string;
  name?: string;
  desc?: string;
  version?: string;
  flow_version?: string;
  flow_version_desc?: string;
  latest_flow_version?: string;
  latest_flow_version_desc?: string;
  commit_id?: string;
  create_time?: Int64Like;
  update_time?: Int64Like;
}

export interface WorkflowSession {
  userName: string;
  userId: string;
  spaceId: string;
}
