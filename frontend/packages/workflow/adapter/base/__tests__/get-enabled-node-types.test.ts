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
import { StandardNodeType } from '@coze-workflow/base/types';

import type * as EnabledNodeTypesModule from '../src/utils/get-enabled-node-types';

const params = {
  isBindDouyin: false,
  isProject: false,
  isSceneFlow: false,
  isSupportImageflowNodes: false,
};

let enabledNodeTypesModule: typeof EnabledNodeTypesModule;

beforeAll(async () => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      fillRect: vi.fn(),
    })),
    configurable: true,
  });

  enabledNodeTypesModule = await import('../src/utils/get-enabled-node-types');
});

describe('getEnabledNodeTypes', () => {
  it('exposes only non-loop-scoped Mirap whitelist nodes by default', () => {
    const { getEnabledNodeTypes, MIRAP_BASE_NODE_TYPES } =
      enabledNodeTypesModule;
    const enabled = getEnabledNodeTypes({ ...params, loopSelected: false });

    expect(enabled).toEqual(
      MIRAP_BASE_NODE_TYPES.filter(
        type =>
          type !== StandardNodeType.Break &&
          type !== StandardNodeType.Continue &&
          type !== StandardNodeType.SetVariable,
      ),
    );

    expect(enabled).not.toContain(StandardNodeType.LLM);
    expect(enabled).not.toContain(StandardNodeType.Api);
    expect(enabled).not.toContain(StandardNodeType.Code);
    expect(enabled).not.toContain(StandardNodeType.Dataset);
    expect(enabled).not.toContain(StandardNodeType.Database);
  });

  it('adds loop-scoped nodes only when a loop or batch container is selected', () => {
    const { getEnabledNodeTypes } = enabledNodeTypesModule;
    const enabled = getEnabledNodeTypes({ ...params, loopSelected: true });

    expect(enabled).toContain(StandardNodeType.Break);
    expect(enabled).toContain(StandardNodeType.Continue);
    expect(enabled).toContain(StandardNodeType.SetVariable);
  });
});
