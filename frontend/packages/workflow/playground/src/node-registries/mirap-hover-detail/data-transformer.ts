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
import { DEFAULT_INPUT_PARAMETERS, createOutputs } from './constants';

export const transformOnInit = (value: NodeDataDTO, context): FormData => {
  if (!value) {
    return {
      inputs: {
        inputParameters: DEFAULT_INPUT_PARAMETERS,
      },
      outputs: createOutputs(),
    } as unknown as FormData;
  }

  const inputParameters = {};
  (value.inputs?.inputParameters ?? []).forEach(item => {
    inputParameters[item.name as string] = nodeUtils.refExpressionDTOToVO(
      item,
      context,
    );
  });

  return {
    ...(value ?? {}),
    outputs: createOutputs(value.outputs),
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

  return {
    ...omit(value, ['inputs']),
    outputs: createOutputs(value.outputs),
    inputs: {
      ...omit(value.inputs ?? {}, ['inputParameters', 'selectedOutputs']),
      inputParameters,
    },
  } as unknown as NodeDataDTO;
};
