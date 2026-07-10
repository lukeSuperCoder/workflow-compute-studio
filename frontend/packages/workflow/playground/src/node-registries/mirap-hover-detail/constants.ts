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
    name: 'area_points',
    label: 'area_points',
    description: '筛选区域网格点字符串，格式如 lng lat,lng lat',
    required: true,
    type: ViewVariableType.String,
  },
  {
    name: 'start_date',
    label: 'start_date',
    description: '开始日期，格式 YYYY-MM-DD',
    required: true,
    type: ViewVariableType.String,
  },
  {
    name: 'end_date',
    label: 'end_date',
    description: '结束日期，格式 YYYY-MM-DD',
    required: true,
    type: ViewVariableType.String,
  },
];

export const DEFAULT_INPUT_PARAMETERS = {
  area_points: {
    type: ValueExpressionType.LITERAL,
  },
  start_date: {
    type: ValueExpressionType.LITERAL,
  },
  end_date: {
    type: ValueExpressionType.LITERAL,
  },
};

export const OUTPUT_NAME = 'turnback_event_details';

export const OUTPUT_TYPE = ViewVariableType.ArrayObject;

export const OUTPUT_FIELDS = [
  { name: 'mmsi', type: ViewVariableType.Integer },
  { name: 'beginTime', type: ViewVariableType.Integer },
  { name: 'endTime', type: ViewVariableType.Integer },
  { name: 'beginLon', type: ViewVariableType.Number },
  { name: 'beginLat', type: ViewVariableType.Number },
  { name: 'endLon', type: ViewVariableType.Number },
  { name: 'endLat', type: ViewVariableType.Number },
  { name: 'duration', type: ViewVariableType.Number },
];

// Keep required output fields declarative so future output fields can be
// configured without changing the form or transformer contract.
export const REQUIRED_OUTPUT_FIELDS = ['mmsi'];

export const createOutputs = (
  existingOutputs: Array<{
    key?: string;
    name?: string;
    children?: Array<{ key?: string; name?: string }>;
  }> = [],
) => {
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
      children: OUTPUT_FIELDS.map(field => ({
        key: existingChildren.get(field.name) ?? nanoid(),
        name: field.name,
        type: field.type,
      })),
    },
  ];
};
