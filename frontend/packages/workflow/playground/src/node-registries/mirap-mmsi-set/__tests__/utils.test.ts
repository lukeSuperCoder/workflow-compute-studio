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

import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect: () => undefined,
    getImageData: () => ({ data: [0, 0, 0, 0] }),
  })) as never;
});

describe('mirap mmsi set utils', () => {
  it('keeps default input groups when no upstream variable is selected', async () => {
    const { DEFAULT_RESULT_FIELDS, createInputName } = await import(
      '../constants'
    );
    const { buildFieldGroups, normalizeInputParameters } = await import(
      '../utils'
    );

    const inputParameters = normalizeInputParameters(undefined);
    const groups = buildFieldGroups(inputParameters, () => ({}));

    expect(groups).toEqual([
      {
        inputName: createInputName(0),
        title: createInputName(0),
        fields: DEFAULT_RESULT_FIELDS,
      },
    ]);
  });

  it('falls back to mmsi fields when variable metadata lookup throws', async () => {
    const { ValueExpressionType } = await import('@coze-workflow/base');
    const { DEFAULT_RESULT_FIELDS } = await import('../constants');
    const { buildFieldGroups, normalizeInputParameters } = await import(
      '../utils'
    );

    const inputParameters = normalizeInputParameters([
      { name: 'dataset_1', input: { type: ValueExpressionType.REF } },
      { name: 'dataset_2', input: { type: ValueExpressionType.REF } },
    ]);

    const groups = buildFieldGroups(inputParameters, () => {
      throw new Error('missing variable facade');
    });

    expect(groups).toEqual([
      {
        inputName: 'dataset_1',
        title: 'dataset_1',
        fields: DEFAULT_RESULT_FIELDS,
      },
      {
        inputName: 'dataset_2',
        title: 'dataset_2',
        fields: DEFAULT_RESULT_FIELDS,
      },
    ]);
  });

  it('extracts all children from array object dto meta', async () => {
    const { VariableTypeDTO } = await import('@coze-workflow/base');
    const { buildFieldGroups, normalizeInputParameters } = await import(
      '../utils'
    );

    const inputParameters = normalizeInputParameters([{ name: 'dataset_1' }]);
    const groups = buildFieldGroups(inputParameters, () => ({
      dtoMeta: {
        name: 'ships',
        type: VariableTypeDTO.list,
        schema: {
          type: VariableTypeDTO.object,
          schema: [
            { name: 'mmsi', type: VariableTypeDTO.integer },
            { name: 'enName', type: VariableTypeDTO.string },
            { name: 'length', type: VariableTypeDTO.float },
          ],
        },
      },
    }));

    expect(groups[0].fields).toEqual([
      expect.objectContaining({ name: 'mmsi' }),
      expect.objectContaining({ name: 'enName' }),
      expect.objectContaining({ name: 'length' }),
    ]);
  });

  it('prefers resolved upstream view metadata children', async () => {
    const { ViewVariableType } = await import('@coze-workflow/base');
    const { extractArrayObjectFields } = await import('../utils');

    const fields = extractArrayObjectFields(undefined, undefined, {
      name: 'ships',
      type: ViewVariableType.ArrayObject,
      children: [
        { name: 'mmsi', type: ViewVariableType.Integer },
        { name: 'enName', type: ViewVariableType.String },
        { name: 'length', type: ViewVariableType.Number },
      ],
    });

    expect(fields).toEqual([
      { name: 'mmsi', type: ViewVariableType.Integer },
      { name: 'enName', type: ViewVariableType.String },
      { name: 'length', type: ViewVariableType.Number },
    ]);
  });

  it('does not resurrect fields hidden by the upstream HTTP selection', async () => {
    const { VariableTypeDTO, ViewVariableType } = await import(
      '@coze-workflow/base'
    );
    const { extractArrayObjectFields } = await import('../utils');

    const fields = extractArrayObjectFields(
      undefined,
      {
        name: 'turnback_event_details',
        type: VariableTypeDTO.list,
        schema: {
          type: VariableTypeDTO.object,
          schema: [
            { name: 'mmsi', type: VariableTypeDTO.integer },
            { name: 'beginTime', type: VariableTypeDTO.integer },
            { name: 'duration', type: VariableTypeDTO.float },
          ],
        },
      },
      {
        name: 'turnback_event_details',
        type: ViewVariableType.ArrayObject,
        children: [
          { name: 'mmsi', type: ViewVariableType.Integer },
          { name: 'duration', type: ViewVariableType.Number },
        ],
      },
    );

    expect(fields).toEqual([
      { name: 'mmsi', type: ViewVariableType.Integer },
      { name: 'duration', type: ViewVariableType.Number },
    ]);
  });
});
