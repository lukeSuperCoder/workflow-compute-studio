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

import { VARIABLE_MERGE_NODE_REGISTRY } from '@/nodes-v2/variable-merge';
import { VARIABLE_ASSIGN_NODE_REGISTRY } from '@/nodes-v2/variable-assign';
import { UNSUPPORTED_LEGACY_NODE_REGISTRIES } from '@/node-registries/unsupported-legacy';
import { TEXT_PROCESS_NODE_REGISTRY } from '@/node-registries/text-process';
import { SUB_WORKFLOW_NODE_REGISTRY } from '@/node-registries/sub-workflow';
import { START_NODE_REGISTRY } from '@/node-registries/start';
import { SET_VARIABLE_NODE_REGISTRY } from '@/node-registries/set-variable';
import { OUTPUT_NODE_REGISTRY } from '@/node-registries/output';
import { MIRAP_STAY_CALC_NODE_REGISTRY } from '@/node-registries/mirap-stay-calc';
import {
  MIRAP_MMSI_DIFFERENCE_NODE_REGISTRY,
  MIRAP_MMSI_INTERSECTION_NODE_REGISTRY,
  MIRAP_MMSI_UNION_NODE_REGISTRY,
} from '@/node-registries/mirap-mmsi-set';
import { MIRAP_HOVER_DETAIL_NODE_REGISTRY } from '@/node-registries/mirap-hover-detail';
import { MIRAP_AREA_SHIP_NODE_REGISTRY } from '@/node-registries/mirap-area-ship';
import { LOOP_NODE_REGISTRY } from '@/node-registries/loop';
import { JSON_STRINGIFY_NODE_REGISTRY } from '@/node-registries/json-stringify';
import { JSON_PARSER_NODE_REGISTRY } from '@/node-registries/json-parser';
import { INPUT_NODE_REGISTRY } from '@/node-registries/input';
import { IF_NODE_REGISTRY } from '@/node-registries/if';
import { HTTP_NODE_REGISTRY } from '@/node-registries/http';
import { END_NODE_REGISTRY } from '@/node-registries/end';
import { CONTINUE_NODE_REGISTRY } from '@/node-registries/continue';
import { COMMENT_NODE_REGISTRY } from '@/node-registries/comment';
import { BREAK_NODE_REGISTRY } from '@/node-registries/break';
import { BATCH_NODE_REGISTRY } from '@/node-registries/batch';

// MIRAP_NODE_REGISTRIES mirrors backend entity.MirapNodeSet: only basic
// flow-control nodes and the six Mirap custom nodes are available for new use.
export const MIRAP_NODE_REGISTRIES = [
  JSON_STRINGIFY_NODE_REGISTRY,
  JSON_PARSER_NODE_REGISTRY,
  IF_NODE_REGISTRY,
  SUB_WORKFLOW_NODE_REGISTRY,
  OUTPUT_NODE_REGISTRY,
  END_NODE_REGISTRY,
  INPUT_NODE_REGISTRY,
  START_NODE_REGISTRY,
  HTTP_NODE_REGISTRY,
  MIRAP_AREA_SHIP_NODE_REGISTRY,
  MIRAP_STAY_CALC_NODE_REGISTRY,
  MIRAP_HOVER_DETAIL_NODE_REGISTRY,
  MIRAP_MMSI_INTERSECTION_NODE_REGISTRY,
  MIRAP_MMSI_UNION_NODE_REGISTRY,
  MIRAP_MMSI_DIFFERENCE_NODE_REGISTRY,
  LOOP_NODE_REGISTRY,
  SET_VARIABLE_NODE_REGISTRY,
  CONTINUE_NODE_REGISTRY,
  BREAK_NODE_REGISTRY,
  BATCH_NODE_REGISTRY,
  COMMENT_NODE_REGISTRY,
  VARIABLE_MERGE_NODE_REGISTRY,
  VARIABLE_ASSIGN_NODE_REGISTRY,
  TEXT_PROCESS_NODE_REGISTRY,
];

// NODES_V2 also registers lightweight unsupported shells for removed legacy
// node types so old workflows can reopen with an explicit unsupported message.
export const NODES_V2 = [
  ...MIRAP_NODE_REGISTRIES,
  ...UNSUPPORTED_LEGACY_NODE_REGISTRIES,
];

export const NODE_V2_TYPES = NODES_V2.map(r => r.type);
