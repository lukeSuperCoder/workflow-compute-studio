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
import { variableUtils } from '@coze-workflow/variable';
import { nodeUtils } from '@coze-workflow/nodes';
import {
  type InputValueVO,
  type NodeDataDTO,
  type ValueExpression,
} from '@coze-workflow/base';

import {
  buildFieldGroups,
  normalizeInputParameters,
  normalizeSelectedGroups,
} from './utils';
import {
  MMSISetOperation,
  type FormData,
  type SelectedOutputGroup,
} from './types';
import { createOutputs } from './constants';

export const createTransformOnInit =
  (operation: MMSISetOperation) =>
  (value: NodeDataDTO, context): FormData => {
    const inputParameters = normalizeInputParameters(
      (value?.inputs?.inputParameters ?? []).map(item => ({
        name: item.name,
        input: nodeUtils.refExpressionDTOToVO(item, context),
      })),
    );

    const fieldGroups = getFieldGroups(inputParameters, context);
    const mainInputName = resolveMainInputName(
      operation,
      value?.inputs?.mainInputName as string | undefined,
      inputParameters,
    );
    const selectedOutputGroups = normalizeSelectedGroups(
      value?.inputs?.selectedOutputGroups as SelectedOutputGroup[] | undefined,
      fieldGroups,
      operation === MMSISetOperation.Difference ? mainInputName : undefined,
    );

    return {
      ...(value ?? {}),
      outputs: createOutputs(selectedOutputGroups, fieldGroups, value?.outputs),
      inputs: {
        ...omit(value?.inputs ?? {}, [
          'inputParameters',
          'selectedOutputGroups',
          'mainInputName',
        ]),
        inputParameters,
        selectedOutputGroups,
        mainInputName,
      },
    } as unknown as FormData;
  };

export const createTransformOnSubmit =
  (operation: MMSISetOperation) =>
  (value: FormData, context): NodeDataDTO => {
    const inputParameters = normalizeInputParameters(
      value.inputs?.inputParameters,
    );
    const fieldGroups = getFieldGroups(inputParameters, context);
    const mainInputName = resolveMainInputName(
      operation,
      value.inputs?.mainInputName,
      inputParameters,
    );
    const selectedOutputGroups = normalizeSelectedGroups(
      value.inputs?.selectedOutputGroups,
      fieldGroups,
      operation === MMSISetOperation.Difference ? mainInputName : undefined,
    );

    const inputParameterDTOs = inputParameters.flatMap(item => {
      const input =
        nodeUtils.refExpressionToValueDTO(
          item.input as unknown as ValueExpression,
          context,
        )?.input ?? resolveReferenceDTO(item, context);
      return input
        ? [
            {
              name: item.name,
              input,
            },
          ]
        : [];
    });

    return {
      ...omit(value, ['inputs']),
      outputs: createOutputs(selectedOutputGroups, fieldGroups, value.outputs),
      inputs: {
        ...omit(value.inputs ?? {}, [
          'inputParameters',
          'selectedOutputGroups',
          'mainInputName',
        ]),
        inputParameters: inputParameterDTOs,
        selectedOutputGroups,
        mainInputName,
      },
    } as unknown as NodeDataDTO;
  };

const resolveReferenceDTO = (item: InputValueVO, context) => {
  const keyPath = (
    item.input as { content?: { keyPath?: string[] } } | undefined
  )?.content?.keyPath;
  if (!keyPath?.length) {
    return undefined;
  }

  const variableService = context?.playgroundContext?.variableService;
  const variableContext = { node: context?.node };
  const workflowVariable =
    variableService?.getVariableFacadeByKeyPath?.(keyPath, variableContext) ??
    variableService?.getWorkflowVariableByKeyPath?.(keyPath, variableContext);

  return workflowVariable?.refExpressionDTO;
};

const resolveMainInputName = (
  operation: MMSISetOperation,
  current: string | undefined,
  inputParameters: InputValueVO[],
) => {
  if (operation !== MMSISetOperation.Difference) {
    return undefined;
  }
  if (current && inputParameters.some(item => item.name === current)) {
    return current;
  }
  return inputParameters[0]?.name;
};

const getFieldGroups = (inputParameters: InputValueVO[], context) =>
  buildFieldGroups(inputParameters, input => {
    const variableService = context?.playgroundContext?.variableService;
    const keyPath = (
      input.input as { content?: { keyPath?: string[] } } | undefined
    )?.content?.keyPath;
    const variableContext = { node: context?.node };
    const workflowVariable =
      variableService?.getVariableFacadeByKeyPath?.(keyPath, variableContext) ??
      variableService?.getWorkflowVariableByKeyPath?.(keyPath, variableContext);
    return {
      title: workflowVariable?.viewMeta?.name || input.name,
      viewMeta: workflowVariable?.viewMeta,
      dtoMeta:
        workflowVariable?.dtoMeta ??
        (variableService
          ? variableUtils.getValueExpressionDTOMeta(
              input.input as ValueExpression,
              variableService,
              variableContext,
            )
          : undefined),
    };
  });
