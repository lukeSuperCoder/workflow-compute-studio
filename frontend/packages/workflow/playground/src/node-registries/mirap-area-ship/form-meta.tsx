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

import { nodeMetaValidate } from '@/nodes-v2/materials/node-meta-validate';
import { createValueExpressionInputValidate } from '@/node-registries/common/validators';
import {
  fireNodeTitleChange,
  provideNodeOutputVariablesEffect,
} from '@/node-registries/common/effects';

import { type FormData } from './types';
import { FormRender } from './form';
import { transformOnInit, transformOnSubmit } from './data-transformer';
import { SELECTED_OUTPUTS_PATH } from './constants';

const dateRule = /^\d{4}-\d{2}-\d{2}$/;
const pointsPath = 'inputs.inputParameters.points';
const startDatePath = 'inputs.inputParameters.startdate';
const endDatePath = 'inputs.inputParameters.enddate';

const validateRequiredInput = createValueExpressionInputValidate({
  required: true,
});

const validateDateInput = params => {
  const requiredError = validateRequiredInput(params);
  if (requiredError) {
    return requiredError;
  }
  const literalContent = params.value?.content;
  if (typeof literalContent === 'string' && !dateRule.test(literalContent)) {
    return '日期格式应为 YYYY-MM-DD';
  }
};

const validateSelectedOutputs = params => {
  const { value } = params;
  if (!Array.isArray(value) || value.length === 0) {
    return '请至少选择一个输出字段';
  }
};

export const MIRAP_AREA_SHIP_FORM_META: FormMetaV2<FormData> = {
  render: () => <FormRender />,

  validateTrigger: ValidateTrigger.onChange,

  validate: {
    nodeMeta: nodeMetaValidate,
    [pointsPath]: validateRequiredInput,
    [startDatePath]: validateDateInput,
    [endDatePath]: validateDateInput,
    [SELECTED_OUTPUTS_PATH]: validateSelectedOutputs,
  },

  effect: {
    nodeMeta: fireNodeTitleChange,
    outputs: provideNodeOutputVariablesEffect,
  },

  formatOnInit: transformOnInit,

  formatOnSubmit: transformOnSubmit,
};
