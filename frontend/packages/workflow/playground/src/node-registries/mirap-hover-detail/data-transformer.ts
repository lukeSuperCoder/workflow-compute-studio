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

import { omit } from 'lodash-es';
import { nodeUtils } from '@coze-workflow/nodes';
import { type NodeDataDTO, type ValueExpression } from '@coze-workflow/base';

import { getInputIsEmpty } from '../trigger-upsert/utils';
import { type FormData } from './types';
import {
  DEFAULT_INPUT_PARAMETERS,
  DEFAULT_SELECTED_OUTPUTS,
  createOutputs,
  normalizeSelectedOutputs,
} from './constants';

const resolveSelectedOutputs = (raw: unknown): string[] => {
  if (Array.isArray(raw) && raw.length > 0) {
    return normalizeSelectedOutputs(
      raw.filter((value): value is string => typeof value === 'string'),
    );
  }
  return DEFAULT_SELECTED_OUTPUTS;
};

export const transformOnInit = (value: NodeDataDTO, context): FormData => {
  if (!value) {
    const selectedOutputs = DEFAULT_SELECTED_OUTPUTS;
    return {
      inputs: {
        inputParameters: DEFAULT_INPUT_PARAMETERS,
        selectedOutputs,
      },
      outputs: createOutputs(selectedOutputs),
    } as unknown as FormData;
  }

  const inputParameters = {};
  (value.inputs?.inputParameters ?? []).forEach(item => {
    inputParameters[item.name as string] = nodeUtils.refExpressionDTOToVO(
      item,
      context,
    );
  });

  const selectedOutputs = resolveSelectedOutputs(
    (value.inputs as Record<string, unknown> | undefined)?.selectedOutputs,
  );

  return {
    ...(value ?? {}),
    outputs: createOutputs(selectedOutputs, value.outputs),
    inputs: {
      ...omit(value.inputs ?? {}, ['inputParameters', 'selectedOutputs']),
      inputParameters: {
        ...DEFAULT_INPUT_PARAMETERS,
        ...omit(inputParameters, ['points', 'startdate', 'enddate']),
        // Migrate the previous generic variable names when reopening a saved
        // workflow, so existing input bindings are not silently discarded.
        area_points: inputParameters.area_points ?? inputParameters.points,
        start_date: inputParameters.start_date ?? inputParameters.startdate,
        end_date: inputParameters.end_date ?? inputParameters.enddate,
      },
      selectedOutputs,
    },
  } as unknown as FormData;
};

export const transformOnSubmit = (value: FormData, context): NodeDataDTO => {
  const inputParameters = Object.entries(value.inputs.inputParameters ?? {})
    .filter(([, v]) => !!getInputIsEmpty(v))
    .map(([k, v]) => ({
      name: k,
      input: nodeUtils.refExpressionToValueDTO(
        v as unknown as ValueExpression,
        context,
      )?.input,
    }));

  const selectedOutputs = resolveSelectedOutputs(value.inputs?.selectedOutputs);

  return {
    ...omit(value, ['inputs']),
    outputs: createOutputs(selectedOutputs, value.outputs),
    inputs: {
      ...omit(value.inputs ?? {}, ['inputParameters', 'selectedOutputs']),
      inputParameters,
      selectedOutputs,
    },
  } as unknown as NodeDataDTO;
};
