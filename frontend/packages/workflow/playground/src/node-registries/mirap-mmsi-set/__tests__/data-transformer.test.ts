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

import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  (globalThis as Record<string, unknown>).IS_OVERSEA = false;
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect: () => undefined,
    getImageData: () => ({ data: [0, 0, 0, 0] }),
  })) as never;
});

describe('mirap mmsi set data transformer', () => {
  it('keeps valid references when the legacy DTO converter cannot resolve them', () =>
    runReferenceFallbackTest());
});

const runReferenceFallbackTest = async () => {
  const { nodeUtils } = await import('@coze-workflow/nodes');
  const { ValueExpressionType, ViewVariableType } = await import(
    '@coze-workflow/base'
  );
  const { createTransformOnSubmit } = await import('../data-transformer');
  const { MMSISetOperation } = await import('../types');

  vi.spyOn(nodeUtils, 'refExpressionToValueDTO').mockReturnValue(undefined);

  const referenceDTO = {
    type: 'list',
    schema: { type: 'object', schema: [{ name: 'mmsi', type: 'integer' }] },
    value: {
      type: 'ref',
      content: {
        source: 'block-output',
        blockID: 'upstream-1',
        name: 'ships',
      },
    },
  };
  const variableService = {
    getWorkflowVariableByKeyPath: vi.fn(() => ({
      viewMeta: {
        name: 'ships',
        type: ViewVariableType.ArrayObject,
        children: [{ name: 'mmsi', type: ViewVariableType.Integer }],
      },
      dtoMeta: referenceDTO,
      refExpressionDTO: referenceDTO,
    })),
  };
  const context = {
    node: {},
    playgroundContext: { variableService },
  };
  const value = {
    inputs: {
      inputParameters: [
        {
          name: 'dataset_1',
          input: {
            type: ValueExpressionType.REF,
            content: { keyPath: ['upstream-1', 'ships-key'] },
          },
        },
        {
          name: 'dataset_2',
          input: {
            type: ValueExpressionType.REF,
            content: { keyPath: ['upstream-2', 'ships-key'] },
          },
        },
      ],
      selectedOutputGroups: [
        { inputName: 'dataset_1', fields: ['mmsi'] },
        { inputName: 'dataset_2', fields: ['mmsi'] },
      ],
    },
    outputs: [],
  } as never;

  const output = createTransformOnSubmit(MMSISetOperation.Union)(
    value,
    context,
  );

  expect(output.inputs?.inputParameters).toEqual([
    { name: 'dataset_1', input: referenceDTO },
    { name: 'dataset_2', input: referenceDTO },
  ]);
};
