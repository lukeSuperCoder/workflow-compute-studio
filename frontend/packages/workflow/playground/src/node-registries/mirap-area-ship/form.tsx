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

import { I18n } from '@coze-arch/i18n';

import { FixedInputParameter } from '@/node-registries/trigger-upsert/components/fixed-input-parameter-field';
import { withNodeConfigForm } from '@/node-registries/common/hocs';
import { DataTypeTag } from '@/node-registries/common/components';
import { Section } from '@/form';

import {
  INPUT_FIELDS,
  INPUT_PATH,
  OUTPUT_NAME,
  OUTPUT_TYPE,
  SHIP_FIELDS,
} from './constants';

export const FormRender = withNodeConfigForm(() => (
  <>
    <Section title={I18n.t('workflow_detail_node_input', {}, '输入')}>
      <div className="flex flex-col gap-[8px]">
        <FixedInputParameter
          layout="horizontal"
          name={INPUT_PATH}
          fieldConfig={INPUT_FIELDS}
        />
      </div>
    </Section>
    <Section title={I18n.t('workflow_detail_node_output', {}, '输出')}>
      {/* The output contract is fixed and not editable here. */}
      <div className="flex flex-col gap-[8px]">
        <div className="flex min-h-[28px] items-center justify-between gap-[8px]">
          <span className="text-[13px]">{OUTPUT_NAME}</span>
          <DataTypeTag type={OUTPUT_TYPE} />
        </div>
        <div className="flex flex-col gap-[4px] pl-[16px]">
          {SHIP_FIELDS.map(field => (
            <div
              key={field.name}
              className="flex min-h-[24px] items-center justify-between gap-[8px]"
            >
              <span className="text-[12px] coz-fg-secondary">{field.name}</span>
              <DataTypeTag type={field.type} />
            </div>
          ))}
        </div>
      </div>
    </Section>
  </>
));
