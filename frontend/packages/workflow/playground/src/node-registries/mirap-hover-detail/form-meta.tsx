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

const dateRule = /^\d{4}-\d{2}-\d{2}$/;
const areaPointsPath = 'inputs.inputParameters.area_points';
const startDatePath = 'inputs.inputParameters.start_date';
const endDatePath = 'inputs.inputParameters.end_date';

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

export const MIRAP_HOVER_DETAIL_FORM_META: FormMetaV2<FormData> = {
  render: () => <FormRender />,

  validateTrigger: ValidateTrigger.onChange,

  validate: {
    nodeMeta: nodeMetaValidate,
    [areaPointsPath]: validateRequiredInput,
    [startDatePath]: validateDateInput,
    [endDatePath]: validateDateInput,
  },

  effect: {
    nodeMeta: fireNodeTitleChange,
    outputs: provideNodeOutputVariablesEffect,
  },

  formatOnInit: transformOnInit,

  formatOnSubmit: transformOnSubmit,
};
