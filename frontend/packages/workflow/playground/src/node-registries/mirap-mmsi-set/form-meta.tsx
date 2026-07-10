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

import {
  ValidateTrigger,
  type FormMetaV2,
} from '@flowgram-adapter/free-layout-editor';
import { ValueExpression, type InputValueVO } from '@coze-workflow/base';

import { nodeMetaValidate } from '@/nodes-v2/materials/node-meta-validate';
import {
  fireNodeTitleChange,
  provideNodeOutputVariablesEffect,
} from '@/node-registries/common/effects';

import { MMSISetOperation, type FormData } from './types';
import { FormRender } from './form';
import {
  createTransformOnInit,
  createTransformOnSubmit,
} from './data-transformer';
import {
  INPUT_PATH,
  MAIN_INPUT_NAME_PATH,
  SELECTED_OUTPUT_GROUPS_PATH,
} from './constants';

export const createMMSISetFormMeta = (
  operation: MMSISetOperation,
): FormMetaV2<FormData> => ({
  render: () => <FormRender operation={operation} />,

  validateTrigger: ValidateTrigger.onChange,

  validate: {
    nodeMeta: nodeMetaValidate,
    [INPUT_PATH]: validateInputParameters,
    [SELECTED_OUTPUT_GROUPS_PATH]: validateSelectedGroups,
    ...(operation === MMSISetOperation.Difference
      ? { [MAIN_INPUT_NAME_PATH]: validateMainInputName }
      : {}),
  },

  effect: {
    nodeMeta: fireNodeTitleChange,
    outputs: provideNodeOutputVariablesEffect,
  },

  formatOnInit: createTransformOnInit(operation),

  formatOnSubmit: createTransformOnSubmit(operation),
});

const validateInputParameters = params => {
  const value = params.value as InputValueVO[];
  if (!Array.isArray(value) || value.length < 2) {
    return '请至少选择两个输入结果集';
  }
  if (value.some(item => ValueExpression.isEmpty(item?.input))) {
    return '请选择上游对象数组结果集';
  }
};

const validateSelectedGroups = params => {
  const { value } = params;
  if (!Array.isArray(value) || value.length < 2) {
    return '请至少选择两个输入结果集';
  }
  if (
    value.some(
      group => !Array.isArray(group?.fields) || !group.fields.includes('mmsi'),
    )
  ) {
    return '输入结果集必须包含 mmsi 字段';
  }
};

const validateMainInputName = params => {
  if (!params.value) {
    return '请选择主结果集';
  }
};
