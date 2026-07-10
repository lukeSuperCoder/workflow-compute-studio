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
import { StandardNodeType, ViewVariableType } from '@coze-workflow/base';

import {
  MMSISetOperation,
  type OutputFieldGroup,
  type OutputFieldMeta,
  type SelectedOutputGroup,
} from './types';

export const INPUT_PATH = 'inputs.inputParameters';
export const SELECTED_OUTPUT_GROUPS_PATH = 'inputs.selectedOutputGroups';
export const MAIN_INPUT_NAME_PATH = 'inputs.mainInputName';

export const OUTPUT_NAME = 'result';
export const OUTPUT_TYPE = ViewVariableType.ArrayObject;
export const MMSI_FIELD = 'mmsi';

export const DEFAULT_RESULT_FIELDS: OutputFieldMeta[] = [
  { name: MMSI_FIELD, type: ViewVariableType.Integer },
];

export const OPERATION_META = {
  [MMSISetOperation.Intersection]: {
    nodeType: StandardNodeType.MirapMMSIIntersection,
    title: 'MMSI 交集',
    summary: '按 MMSI 取交集',
  },
  [MMSISetOperation.Union]: {
    nodeType: StandardNodeType.MirapMMSIUnion,
    title: 'MMSI 并集',
    summary: '按 MMSI 取并集',
  },
  [MMSISetOperation.Difference]: {
    nodeType: StandardNodeType.MirapMMSIDifference,
    title: 'MMSI 差集',
    summary: '按 MMSI 做差集',
  },
} as const;

export const arrayObjectOnlyDisabledTypes = ViewVariableType.getComplement([
  ViewVariableType.ArrayObject,
]);

export const createInputName = (index: number) => `dataset_${index + 1}`;

export const createOutputs = (
  selectedGroups: SelectedOutputGroup[] = [],
  fieldGroups: OutputFieldGroup[] = [],
  existingOutputs: Array<{
    key?: string;
    name?: string;
    children?: Array<{ key?: string; name?: string }>;
  }> = [],
) => {
  const children = flattenSelectedFields(selectedGroups, fieldGroups);
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
      children: children.map(field => ({
        key: existingChildren.get(field.name) ?? nanoid(),
        name: field.name,
        type: field.type,
      })),
    },
  ];
};

export const flattenSelectedFields = (
  selectedGroups: SelectedOutputGroup[],
  fieldGroups: OutputFieldGroup[],
): OutputFieldMeta[] => {
  const groupMap = new Map(fieldGroups.map(group => [group.inputName, group]));
  const selectedByGroup = new Map(
    selectedGroups.map(group => [group.inputName, new Set(group.fields)]),
  );
  const seen = new Set<string>();
  const result: OutputFieldMeta[] = [];

  const addField = (field: OutputFieldMeta) => {
    if (seen.has(field.name)) {
      return;
    }
    seen.add(field.name);
    result.push(field);
  };

  addField(DEFAULT_RESULT_FIELDS[0]);

  for (const selectedGroup of selectedGroups) {
    const group = groupMap.get(selectedGroup.inputName);
    if (!group) {
      continue;
    }
    const selected = selectedByGroup.get(selectedGroup.inputName);
    for (const field of group.fields) {
      if (field.name === MMSI_FIELD) {
        continue;
      }
      if (selected?.has(field.name)) {
        addField(field);
      }
    }
  }

  return result;
};
