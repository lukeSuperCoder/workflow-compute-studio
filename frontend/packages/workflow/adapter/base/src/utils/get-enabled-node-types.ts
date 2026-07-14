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

import { StandardNodeType } from '@coze-workflow/base';

// MIRAP_BASE_NODE_TYPES is the add-panel whitelist for Mirap Workflow Studio.
// It restricts the node panel to basic flow-control nodes plus the six Mirap
// custom nodes.
export const MIRAP_BASE_NODE_TYPES: StandardNodeType[] = [
  StandardNodeType.Start,
  StandardNodeType.End,
  StandardNodeType.Input,
  StandardNodeType.Output,
  StandardNodeType.If,
  StandardNodeType.Loop,
  StandardNodeType.Batch,
  StandardNodeType.Break,
  StandardNodeType.Continue,
  StandardNodeType.SetVariable,
  StandardNodeType.VariableMerge,
  StandardNodeType.JsonStringify,
  StandardNodeType.JsonParser,
  StandardNodeType.Text,
  StandardNodeType.Http,
  StandardNodeType.SubWorkflow,
  StandardNodeType.Comment,
  StandardNodeType.MirapAreaShipExtractor,
  StandardNodeType.MirapStayCalculation,
  StandardNodeType.MirapHoverDetail,
  StandardNodeType.MirapMMSIIntersection,
  StandardNodeType.MirapMMSIUnion,
  StandardNodeType.MirapMMSIDifference,
  StandardNodeType.MirapMMSIExtractor,
];

// getEnabledNodeTypes returns the whitelisted node types available in the node
// panel. Break / Continue / SetVariable are loop-scoped and only surface when a
// loop/batch container is selected.
export const getEnabledNodeTypes = (params: {
  loopSelected: boolean;
  isProject: boolean;
  isSupportImageflowNodes: boolean;
  isSceneFlow: boolean;
  isBindDouyin: boolean;
}) => {
  const { loopSelected } = params;

  const loopScoped: StandardNodeType[] = loopSelected
    ? [
        StandardNodeType.Break,
        StandardNodeType.Continue,
        StandardNodeType.SetVariable,
      ]
    : [];

  const alwaysOn = MIRAP_BASE_NODE_TYPES.filter(
    type =>
      type !== StandardNodeType.Break &&
      type !== StandardNodeType.Continue &&
      type !== StandardNodeType.SetVariable,
  );

  return [...alwaysOn, ...loopScoped];
};
