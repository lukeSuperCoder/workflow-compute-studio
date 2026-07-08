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
    description: '网格点字符串，格式如 lng lat,lng lat',
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
  { name: 'enName', type: ViewVariableType.String },
  { name: 'age', type: ViewVariableType.Number },
  { name: 'countrycode', type: ViewVariableType.String },
  { name: 'shipType', type: ViewVariableType.String },
  { name: 'length', type: ViewVariableType.Number },
  { name: 'width', type: ViewVariableType.Number },
  { name: 'dwt', type: ViewVariableType.Integer },
  { name: 'tradetype', type: ViewVariableType.String },
];

// Build a fresh outputs array with unique keys. Called on init and submit so
// every node instance owns its own variable keys.
export const createOutputs = () => [
  {
    key: nanoid(),
    name: OUTPUT_NAME,
    type: OUTPUT_TYPE,
    children: SHIP_FIELDS.map(field => ({
      key: nanoid(),
      name: field.name,
      type: field.type,
    })),
  },
];
