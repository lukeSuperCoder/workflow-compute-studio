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

import { describe, expect, it, vi } from 'vitest';
import { StandardNodeType } from '@coze-workflow/base';

import { MIRAP_STAY_CALC_NODE_REGISTRY } from '../mirap-stay-calc/node-registry';
import {
  MIRAP_MMSI_DIFFERENCE_NODE_REGISTRY,
  MIRAP_MMSI_INTERSECTION_NODE_REGISTRY,
  MIRAP_MMSI_UNION_NODE_REGISTRY,
} from '../mirap-mmsi-set/node-registry';
import { MIRAP_HOVER_DETAIL_NODE_REGISTRY } from '../mirap-hover-detail/node-registry';
import { MIRAP_AREA_SHIP_NODE_REGISTRY } from '../mirap-area-ship/node-registry';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect: () => undefined,
    getImageData: () => ({ data: [0, 0, 0, 0] }),
  })) as never;
});

vi.mock('@coze-workflow/nodes', () => ({
  DEFAULT_NODE_META_PATH: 'nodeMeta',
  DEFAULT_OUTPUTS_PATH: 'outputs',
}));
vi.mock('@/test-run-kit', () => ({
  generateParametersToProperties: () => [],
}));
vi.mock('../mirap-area-ship/form-meta', () => ({
  MIRAP_AREA_SHIP_FORM_META: {},
}));
vi.mock('../mirap-stay-calc/form-meta', () => ({
  MIRAP_STAY_CALC_FORM_META: {},
}));
vi.mock('../mirap-hover-detail/form-meta', () => ({
  MIRAP_HOVER_DETAIL_FORM_META: {},
}));
vi.mock('../mirap-mmsi-set/form-meta', () => ({
  createMMSISetFormMeta: () => ({}),
}));

describe('Mirap node registry persistence contract', () => {
  it.each([
    [MIRAP_AREA_SHIP_NODE_REGISTRY, StandardNodeType.MirapAreaShipExtractor],
    [MIRAP_STAY_CALC_NODE_REGISTRY, StandardNodeType.MirapStayCalculation],
    [MIRAP_HOVER_DETAIL_NODE_REGISTRY, StandardNodeType.MirapHoverDetail],
    [
      MIRAP_MMSI_INTERSECTION_NODE_REGISTRY,
      StandardNodeType.MirapMMSIIntersection,
    ],
    [MIRAP_MMSI_UNION_NODE_REGISTRY, StandardNodeType.MirapMMSIUnion],
    [MIRAP_MMSI_DIFFERENCE_NODE_REGISTRY, StandardNodeType.MirapMMSIDifference],
  ])('keeps registry type and nodeDTOType aligned', (registry, nodeType) => {
    expect(registry.type).toBe(nodeType);
    expect(registry.meta.nodeDTOType).toBe(nodeType);
  });
});
