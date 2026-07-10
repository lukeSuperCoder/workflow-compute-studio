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

import { useCallback, useEffect, useMemo } from 'react';

import {
  useCurrentEntity,
  useService,
} from '@flowgram-adapter/free-layout-editor';
import { WorkflowVariableFacadeService } from '@coze-workflow/variable';
import { ValueExpressionType, type InputValueVO } from '@coze-workflow/base';
import { Checkbox, Select } from '@coze-arch/coze-design';

import { withNodeConfigForm } from '@/node-registries/common/hocs';
import { InputsField } from '@/node-registries/common/fields';
import { DataTypeTag } from '@/node-registries/common/components';
import { Section, useForm, useWatch } from '@/form';

import {
  buildFieldGroups,
  normalizeInputParameters,
  normalizeSelectedGroups,
} from './utils';
import {
  type FormData,
  MMSISetOperation,
  type OutputFieldGroup,
  type SelectedOutputGroup,
} from './types';
import {
  INPUT_PATH,
  MAIN_INPUT_NAME_PATH,
  MMSI_FIELD,
  SELECTED_OUTPUT_GROUPS_PATH,
  arrayObjectOnlyDisabledTypes,
  createInputName,
  createOutputs,
} from './constants';

interface FormRenderProps {
  operation: MMSISetOperation;
}

export const FormRender = withNodeConfigForm(
  ({ operation }: FormRenderProps) => {
    const form = useForm();
    const node = useCurrentEntity();
    const variableService = useService(WorkflowVariableFacadeService);
    const watchedInputParameters = useWatch<InputValueVO[]>(INPUT_PATH);
    const inputParameters = useMemo(
      () => normalizeInputParameters(watchedInputParameters),
      [watchedInputParameters],
    );
    const rawSelectedGroups =
      useWatch<SelectedOutputGroup[]>(SELECTED_OUTPUT_GROUPS_PATH) ?? [];
    const watchedMainInputName = useWatch<string>(MAIN_INPUT_NAME_PATH);
    const outputs = useWatch<FormData['outputs']>('outputs') ?? [];

    const fieldGroups = useMemo(
      () =>
        buildFieldGroups(inputParameters, input => {
          const keyPath = (
            input.input as { content?: { keyPath?: string[] } } | undefined
          )?.content?.keyPath;
          const workflowVariable = variableService.getVariableFacadeByKeyPath(
            keyPath,
            { node },
          );
          return {
            title: workflowVariable?.viewMeta?.name || input.name,
            viewMeta: workflowVariable?.viewMeta,
            dtoMeta: workflowVariable?.dtoMeta,
          };
        }),
      [inputParameters, node, variableService],
    );

    const mainInputName =
      operation === MMSISetOperation.Difference
        ? watchedMainInputName || inputParameters[0]?.name
        : undefined;

    const selectedGroups = useMemo(
      () =>
        normalizeSelectedGroups(
          rawSelectedGroups,
          fieldGroups,
          operation === MMSISetOperation.Difference ? mainInputName : undefined,
        ),
      [fieldGroups, mainInputName, operation, rawSelectedGroups],
    );

    const visibleFieldGroups =
      operation === MMSISetOperation.Difference
        ? fieldGroups.filter(group => group.inputName === mainInputName)
        : fieldGroups;

    const syncOutputs = useCallback(
      (
        nextSelectedGroups: SelectedOutputGroup[],
        nextFieldGroups = fieldGroups,
      ) => {
        form.setValueIn(SELECTED_OUTPUT_GROUPS_PATH, nextSelectedGroups);
        form.setValueIn(
          'outputs',
          createOutputs(nextSelectedGroups, nextFieldGroups, outputs),
        );
      },
      [fieldGroups, form, outputs],
    );

    useEffect(() => {
      if (
        JSON.stringify(rawSelectedGroups) !== JSON.stringify(selectedGroups)
      ) {
        form.setValueIn(SELECTED_OUTPUT_GROUPS_PATH, selectedGroups);
      }
      const nextOutputs = createOutputs(selectedGroups, fieldGroups, outputs);
      if (JSON.stringify(outputs) !== JSON.stringify(nextOutputs)) {
        form.setValueIn('outputs', nextOutputs);
      }
    }, [fieldGroups, form, outputs, rawSelectedGroups, selectedGroups]);

    useEffect(() => {
      if (operation !== MMSISetOperation.Difference) {
        return;
      }
      if (mainInputName && watchedMainInputName !== mainInputName) {
        form.setValueIn(MAIN_INPUT_NAME_PATH, mainInputName);
      }
    }, [form, mainInputName, operation, watchedMainInputName]);

    const toggleField = useCallback(
      (group: OutputFieldGroup, fieldName: string, checked: boolean) => {
        if (fieldName === MMSI_FIELD) {
          return;
        }
        const next = selectedGroups.map(selectedGroup => {
          if (selectedGroup.inputName !== group.inputName) {
            return selectedGroup;
          }
          const current = new Set(selectedGroup.fields);
          if (checked) {
            current.add(fieldName);
          } else {
            current.delete(fieldName);
          }
          current.add(MMSI_FIELD);
          return {
            ...selectedGroup,
            fields: group.fields
              .map(field => field.name)
              .filter(name => current.has(name)),
          };
        });
        syncOutputs(next);
      },
      [selectedGroups, syncOutputs],
    );

    const selectMainInput = useCallback(
      (value: string) => {
        form.setValueIn(MAIN_INPUT_NAME_PATH, value);
        const next = normalizeSelectedGroups(
          rawSelectedGroups,
          fieldGroups,
          value,
        );
        syncOutputs(next);
      },
      [fieldGroups, form, rawSelectedGroups, syncOutputs],
    );

    const mainInputOptions = inputParameters.map(input => ({
      label: input.name,
      value: input.name,
    }));

    return (
      <>
        <InputsField
          name={INPUT_PATH}
          title="输入结果集"
          paramsTitle="结果集"
          expressionTitle="上游数组"
          defaultValue={[defaultInputParameter(0)]}
          onAppend={() => defaultInputParameter(inputParameters.length)}
          literalDisabled={true}
          inputProps={{
            disabledTypes: arrayObjectOnlyDisabledTypes,
            literalDisabled: true,
          }}
          nameProps={{ readonly: true }}
        />

        {operation === MMSISetOperation.Difference ? (
          <Section title="主结果集">
            <Select
              size="small"
              value={mainInputName}
              optionList={mainInputOptions}
              style={{ width: '100%' }}
              onChange={selectMainInput}
            />
          </Section>
        ) : null}

        <Section title="输出字段">
          <div className="flex flex-col gap-[12px]">
            {visibleFieldGroups.map(group => {
              const selected = new Set(
                selectedGroups.find(item => item.inputName === group.inputName)
                  ?.fields ?? [],
              );
              return (
                <div key={group.inputName} className="flex flex-col gap-[6px]">
                  <div className="text-[13px] font-medium coz-fg-primary">
                    {group.title}
                  </div>
                  <div className="flex flex-col gap-[4px] pl-[16px]">
                    {group.fields.map(field => (
                      <div
                        key={field.name}
                        className="flex min-h-[24px] items-center justify-between gap-[8px]"
                      >
                        <Checkbox
                          checked={
                            field.name === MMSI_FIELD ||
                            selected.has(field.name)
                          }
                          disabled={field.name === MMSI_FIELD}
                          onChange={(e: { target: { checked: boolean } }) =>
                            toggleField(group, field.name, e.target.checked)
                          }
                        >
                          <span className="text-[12px] coz-fg-secondary">
                            {field.name}
                          </span>
                        </Checkbox>
                        <DataTypeTag type={field.type} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </>
    );
  },
);

const defaultInputParameter = (index: number): InputValueVO => ({
  name: createInputName(index),
  input: { type: ValueExpressionType.REF },
});
