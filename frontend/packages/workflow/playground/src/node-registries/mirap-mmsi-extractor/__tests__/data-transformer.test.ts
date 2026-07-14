/*
 * Copyright 2025 coze-dev Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeUtils } from '@coze-workflow/nodes';
import {
  ValueExpressionType,
  ViewVariableType,
} from '@coze-workflow/base';

import { transformOnSubmit } from '../data-transformer';

vi.hoisted(() => {
  (globalThis as Record<string, unknown>).IS_OVERSEA = false;
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect: () => undefined,
    getImageData: () => ({ data: [0, 0, 0, 0] }),
  })) as never;
});

describe('MMSI extractor data transformer', () => {
  it('keeps multiple references and fixes input names and output schema', () => {
    vi.spyOn(nodeUtils, 'refExpressionToValueDTO').mockReturnValue(undefined);

    const referenceDTO = {
      type: 'list',
      value: {
        type: 'ref',
        content: { blockID: 'upstream-1', name: 'ships' },
      },
    };
    const context = {
      node: {},
      playgroundContext: {
        variableService: {
          getVariableFacadeByKeyPath: vi.fn(() => ({
            refExpressionDTO: referenceDTO,
          })),
        },
      },
    };
    const input = {
      inputs: {
        inputParameters: ['a', 'b'].map((name, index) => ({
          name,
          input: {
            type: ValueExpressionType.REF,
            content: { keyPath: [`upstream-${index + 1}`, 'ships'] },
          },
        })),
      },
      outputs: [],
    } as never;

    const output = transformOnSubmit(input, context);

    expect(output.inputs?.inputParameters).toEqual([
      { name: 'dataset_1', input: referenceDTO },
      { name: 'dataset_2', input: referenceDTO },
    ]);
    expect(output.outputs?.[0]).toMatchObject({
      name: 'mmsis',
      type: ViewVariableType.String,
    });
  });
});
