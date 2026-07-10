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

import { FlowNodeFormData } from '@flowgram-adapter/free-layout-editor';

import {
  generateParametersToProperties,
  type NodeTestMeta,
} from '@/test-run-kit';

import { INPUT_FIELDS } from './constants';

export const test: NodeTestMeta = {
  generateFormInputProperties(node) {
    const formData = node
      .getData(FlowNodeFormData)
      .formModel.getFormItemValueByPath('/');
    const inputParameters = formData?.inputs?.inputParameters;
    const labelMap = Object.fromEntries(
      INPUT_FIELDS.map(field => [field.name, field.label]),
    );
    const requiredKeys = INPUT_FIELDS.filter(field => field.required).map(
      field => field.name,
    );

    return generateParametersToProperties(
      Object.entries(inputParameters || {}).map(([key, value]) => ({
        name: key,
        title: labelMap[key] || key,
        required: requiredKeys.includes(key),
        input: value,
      })),
      { node },
    );
  },
};

export type { NodeTestMeta };
