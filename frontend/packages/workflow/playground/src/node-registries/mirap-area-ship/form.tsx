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

import { useCallback } from 'react';

import { I18n } from '@coze-arch/i18n';
import { Checkbox } from '@coze-arch/coze-design';

import { FixedInputParameter } from '@/node-registries/trigger-upsert/components/fixed-input-parameter-field';
import { withNodeConfigForm } from '@/node-registries/common/hocs';
import { DataTypeTag } from '@/node-registries/common/components';
import { useForm, useWatch } from '@/form';
import { Section } from '@/form';

import {
  INPUT_FIELDS,
  INPUT_PATH,
  OUTPUT_NAME,
  OUTPUT_TYPE,
  SELECTED_OUTPUTS_PATH,
  SHIP_FIELDS,
  DEFAULT_SELECTED_OUTPUTS,
  createOutputs,
} from './constants';

export const FormRender = withNodeConfigForm(() => {
  const form = useForm();
  const selected =
    useWatch<string[]>(SELECTED_OUTPUTS_PATH) ?? DEFAULT_SELECTED_OUTPUTS;

  const toggleField = useCallback(
    (name: string, checked: boolean) => {
      const current = new Set(selected);
      if (checked) {
        current.add(name);
      } else {
        current.delete(name);
      }
      // preserve canonical field ordering
      const next = SHIP_FIELDS.map(field => field.name).filter(item =>
        current.has(item),
      );
      form.setValueIn(SELECTED_OUTPUTS_PATH, next);
      // re-derive outputs so only selected fields are emitted and exposed
      // downstream.
      form.setValueIn('outputs', createOutputs(next));
    },
    [form, selected],
  );

  return (
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
        <div className="flex flex-col gap-[8px]">
          <div className="flex min-h-[28px] items-center justify-between gap-[8px]">
            <span className="text-[13px]">{OUTPUT_NAME}</span>
            <DataTypeTag type={OUTPUT_TYPE} />
          </div>
          <div className="flex flex-col gap-[4px] pl-[16px]">
            {SHIP_FIELDS.map(field => {
              const checked = selected.includes(field.name);
              return (
                <div
                  key={field.name}
                  className="flex min-h-[24px] items-center justify-between gap-[8px]"
                >
                  <Checkbox
                    checked={checked}
                    onChange={(e: { target: { checked: boolean } }) =>
                      toggleField(field.name, e.target.checked)
                    }
                  >
                    <span className="text-[12px] coz-fg-secondary">
                      {field.name}
                    </span>
                  </Checkbox>
                  <DataTypeTag type={field.type} />
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    </>
  );
});
