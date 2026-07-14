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

import { StandardNodeType, useWorkflowNode } from '@coze-workflow/base';

import { SubWorkflowContent as SubWorkflowContentV2 } from '@/node-registries/sub-workflow';
import { StartContent } from '@/node-registries/start';
import { SetVariableContent } from '@/node-registries/set-variable';
import { OutputContent } from '@/node-registries/output';
import { MirapStayCalcContent } from '@/node-registries/mirap-stay-calc';
import { MirapMMSISetContent } from '@/node-registries/mirap-mmsi-set';
import { MirapMMSIExtractorContent } from '@/node-registries/mirap-mmsi-extractor';
import { MirapHttpApiContent } from '@/node-registries/mirap-http-api';
import { MirapHoverDetailContent } from '@/node-registries/mirap-hover-detail';
import { MirapAreaShipContent } from '@/node-registries/mirap-area-ship';
import { LoopContent } from '@/node-registries/loop';
import { JsonStringifyContent } from '@/node-registries/json-stringify';
import { JsonParserContent } from '@/node-registries/json-parser';
import { InputContent } from '@/node-registries/input';
import { IfContent } from '@/node-registries/if';
import { EndContent } from '@/node-registries/end';
import { ContinueContent } from '@/node-registries/continue';
import { BreakContent } from '@/node-registries/break';
import { BatchContent } from '@/node-registries/batch';

import { ExceptionField } from '../fields/exception-field';
import { VariableMergeContent } from './variable-merge-content';
import { VariableAssignContent } from './variable-assign-content';
import { HttpContent } from './http-content';
import { CommonContent } from './common-content';

import styles from './index.module.less';

const ContentMap = {
  [StandardNodeType.Start]: StartContent,
  [StandardNodeType.End]: EndContent,
  [StandardNodeType.If]: IfContent,
  [StandardNodeType.SubWorkflow]: SubWorkflowContentV2,
  [StandardNodeType.Output]: OutputContent,
  [StandardNodeType.Loop]: LoopContent,
  [StandardNodeType.Break]: BreakContent,
  [StandardNodeType.Continue]: ContinueContent,
  [StandardNodeType.SetVariable]: SetVariableContent,
  [StandardNodeType.Batch]: BatchContent,
  [StandardNodeType.Input]: InputContent,
  [StandardNodeType.VariableMerge]: VariableMergeContent,
  [StandardNodeType.VariableAssign]: VariableAssignContent,
  [StandardNodeType.Http]: HttpContent,
  [StandardNodeType.Text]: CommonContent,
  [StandardNodeType.JsonStringify]: JsonStringifyContent,
  [StandardNodeType.JsonParser]: JsonParserContent,
  [StandardNodeType.MirapAreaShipExtractor]: MirapAreaShipContent,
  [StandardNodeType.MirapStayCalculation]: MirapStayCalcContent,
  [StandardNodeType.MirapHoverDetail]: MirapHoverDetailContent,
  [StandardNodeType.MirapMMSIIntersection]: MirapMMSISetContent,
  [StandardNodeType.MirapMMSIUnion]: MirapMMSISetContent,
  [StandardNodeType.MirapMMSIDifference]: MirapMMSISetContent,
  [StandardNodeType.MirapMMSIExtractor]: MirapMMSIExtractorContent,
  [StandardNodeType.MirapBogusFilter]: MirapHttpApiContent,
  [StandardNodeType.MirapBogusDetail]: MirapHttpApiContent,
  [StandardNodeType.MirapHoverFilter]: MirapHttpApiContent,
  [StandardNodeType.MirapHoverEventDetail]: MirapHttpApiContent,
  [StandardNodeType.MirapLeanFilter]: MirapHttpApiContent,
  [StandardNodeType.MirapLeanDetail]: MirapHttpApiContent,
  [StandardNodeType.MirapRemainFilter]: MirapHttpApiContent,
  [StandardNodeType.MirapRemainDetail]: MirapHttpApiContent,
  [StandardNodeType.MirapRetraceFilter]: MirapHttpApiContent,
  [StandardNodeType.MirapSignalSpoofingDetail]: MirapHttpApiContent,
  [StandardNodeType.MirapFakeSignalRecover]: MirapHttpApiContent,
  [StandardNodeType.MirapTrajectoryQuality]: MirapHttpApiContent,
  [StandardNodeType.MirapInterruptFilter]: MirapHttpApiContent,
  [StandardNodeType.MirapRepetitionFilter]: MirapHttpApiContent,
  [StandardNodeType.MirapInterruptDetail]: MirapHttpApiContent,
  [StandardNodeType.MirapLowVelocityDetail]: MirapHttpApiContent,
  [StandardNodeType.MirapSpeedFilter]: MirapHttpApiContent,
  [StandardNodeType.MirapNoRegularFilter]: MirapHttpApiContent,
  [StandardNodeType.MirapOnlineRatioFilter]: MirapHttpApiContent,
};

function UnsupportedLegacyContent() {
  return (
    <div className={styles.unsupported}>
      <div className={styles.unsupportedTitle}>不支持节点</div>
      <div className={styles.unsupportedDesc}>
        该历史节点不在 Mirap Workflow Studio
        白名单内，请删除或替换为支持的节点。
      </div>
    </div>
  );
}

/**
 * Node content area
 */
export function Content() {
  const { type } = useWorkflowNode();
  const NodeContent = ContentMap[type] || UnsupportedLegacyContent;

  return (
    <div className={styles.wrapper}>
      <NodeContent />
      <ExceptionField />
    </div>
  );
}
