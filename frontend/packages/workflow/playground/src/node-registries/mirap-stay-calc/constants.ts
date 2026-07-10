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

import { nanoid } from 'nanoid';
import { ViewVariableType, ValueExpressionType } from '@coze-workflow/base';

export const INPUT_PATH = 'inputs.inputParameters';

export const INPUT_FIELDS = [
  {
    name: 'points',
    label: 'points',
    description: '低速停留计算区域点字符串，格式如 lng lat,lng lat',
    required: true,
    type: ViewVariableType.String,
  },
  {
    name: 'startdate',
    label: 'startdate',
    description: '开始日期，格式 YYYY-MM-DD',
    required: true,
    type: ViewVariableType.String,
  },
  {
    name: 'enddate',
    label: 'enddate',
    description: '结束日期，格式 YYYY-MM-DD',
    required: true,
    type: ViewVariableType.String,
  },
];

export const DEFAULT_INPUT_PARAMETERS = {
  points: {
    type: ValueExpressionType.LITERAL,
  },
  startdate: {
    type: ValueExpressionType.LITERAL,
  },
  enddate: {
    type: ValueExpressionType.LITERAL,
  },
};

// The node exposes a single fixed output `ships` (Array<Object>), whose element
// carries the fields under the API response's `datas`. The element fields and
// their types are fixed by the backend contract.
export const OUTPUT_NAME = 'ships';

export const OUTPUT_TYPE = ViewVariableType.ArrayObject;

export const SHIP_FIELDS: { name: string; type: ViewVariableType }[] = [
  { name: 'mmsi', type: ViewVariableType.Integer },
];

// Path where the selected element field names are persisted in the node data.
// The backend reads this list (via the canvas exclusive config) to filter the
// emitted ship objects at runtime.
export const SELECTED_OUTPUTS_PATH = 'inputs.selectedOutputs';

// All element fields are selected by default so a freshly created node emits
// the full ship record, matching the previous fixed-output behavior.
export const DEFAULT_SELECTED_OUTPUTS = SHIP_FIELDS.map(field => field.name);

// Build a fresh outputs array with unique keys, limited to the selected
// element fields. Called on init, submit, and whenever the selection changes
// so both the persisted outputs and the downstream-exposed variables stay in
// sync with the user's choice.
export const createOutputs = (
  selected: string[] = DEFAULT_SELECTED_OUTPUTS,
  existingOutputs: Array<{
    key?: string;
    name?: string;
    children?: Array<{ key?: string; name?: string }>;
  }> = [],
) => {
  const selectedSet = new Set(selected);
  const existingOutput = existingOutputs.find(
    item => item.name === OUTPUT_NAME,
  );
  const existingChildren = new Map(
    (existingOutput?.children ?? []).map(item => [item.name, item.key]),
  );
  return [
    {
      key: existingOutput?.key ?? nanoid(),
      name: OUTPUT_NAME,
      type: OUTPUT_TYPE,
      children: SHIP_FIELDS.filter(field => selectedSet.has(field.name)).map(
        field => ({
          key: existingChildren.get(field.name) ?? nanoid(),
          name: field.name,
          type: field.type,
        }),
      ),
    },
  ];
};
