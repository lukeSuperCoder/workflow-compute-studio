/*
 * Copyright 2025 coze-dev Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { omit } from 'lodash-es';
import { nodeUtils } from '@coze-workflow/nodes';
import type {
  InputValueVO,
  NodeDataDTO,
  ValueExpression,
} from '@coze-workflow/base';

import type { FormData } from './types';
import { createInputName, createOutputs } from './constants';

const normalize = (value: InputValueVO[] = []) =>
  value.map((item, index) => ({ ...item, name: createInputName(index) }));

export const transformOnInit = (value: NodeDataDTO, context): FormData =>
  ({
    ...(value ?? {}),
    outputs: createOutputs(value?.outputs),
    inputs: {
      ...omit(value?.inputs ?? {}, ['inputParameters']),
      inputParameters: normalize(
        (value?.inputs?.inputParameters ?? []).map(item => ({
          name: item.name,
          input: nodeUtils.refExpressionDTOToVO(item, context),
        })),
      ),
    },
  }) as unknown as FormData;

export const transformOnSubmit = (value: FormData, context): NodeDataDTO => {
  const inputParameters = normalize(value.inputs?.inputParameters);
  return {
    ...omit(value, ['inputs']),
    outputs: createOutputs(value.outputs),
    inputs: {
      ...omit(value.inputs ?? {}, ['inputParameters']),
      inputParameters: inputParameters.flatMap(item => {
        const input =
          nodeUtils.refExpressionToValueDTO(
            item.input as unknown as ValueExpression,
            context,
          )?.input ?? resolveReferenceDTO(item, context);
        return input ? [{ name: item.name, input }] : [];
      }),
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
  const service = context?.playgroundContext?.variableService;
  const variableContext = { node: context?.node };
  return (
    service?.getVariableFacadeByKeyPath?.(keyPath, variableContext) ??
    service?.getWorkflowVariableByKeyPath?.(keyPath, variableContext)
  )?.refExpressionDTO;
};
