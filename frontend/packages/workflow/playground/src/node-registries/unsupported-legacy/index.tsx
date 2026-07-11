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

import {
  StandardNodeType,
  type WorkflowNodeRegistry,
} from '@coze-workflow/base';

export const UNSUPPORTED_LEGACY_NODE_TYPES: StandardNodeType[] = [
  StandardNodeType.LLM,
  StandardNodeType.Api,
  StandardNodeType.Code,
  StandardNodeType.Dataset,
  StandardNodeType.Variable,
  StandardNodeType.Database,
  StandardNodeType.Imageflow,
  StandardNodeType.ImageGenerate,
  StandardNodeType.ImageReference,
  StandardNodeType.Question,
  StandardNodeType.Intent,
  StandardNodeType.ImageCanvas,
  StandardNodeType.SceneChat,
  StandardNodeType.SceneVariable,
  StandardNodeType.LTM,
  StandardNodeType.DatasetWrite,
  StandardNodeType.QueryMessageList,
  StandardNodeType.ClearContext,
  StandardNodeType.CreateConversation,
  StandardNodeType.TriggerUpsert,
  StandardNodeType.TriggerDelete,
  StandardNodeType.TriggerRead,
  StandardNodeType.DatabaseUpdate,
  StandardNodeType.DatabaseQuery,
  StandardNodeType.DatabaseDelete,
  StandardNodeType.DatabaseCreate,
  StandardNodeType.UpdateConversation,
  StandardNodeType.DeleteConversation,
  StandardNodeType.QueryConversationList,
  StandardNodeType.QueryConversationHistory,
  StandardNodeType.CreateMessage,
  StandardNodeType.UpdateMessage,
  StandardNodeType.DeleteMessage,
];

const createUnsupportedLegacyNodeRegistry = (
  type: StandardNodeType,
): WorkflowNodeRegistry => ({
  type,
  meta: {
    nodeDTOType: type,
    size: { width: 360, height: 120 },
    disableSideSheet: true,
    headerReadonly: true,
    hideTest: true,
  },
  formMeta: {
    render: () => <></>,
  },
});

export const UNSUPPORTED_LEGACY_NODE_REGISTRIES =
  UNSUPPORTED_LEGACY_NODE_TYPES.map(createUnsupportedLegacyNodeRegistry);
