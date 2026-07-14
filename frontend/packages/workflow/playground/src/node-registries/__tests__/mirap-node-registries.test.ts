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
import type {
  WorkflowDocument,
  WorkflowNodeEntity,
  WorkflowNodeJSON,
} from '@flowgram-adapter/free-layout-editor';
import { WorkflowJSONFormat } from '@coze-workflow/nodes/src/workflow-json-format';
import { StandardNodeType } from '@coze-workflow/base';

import { MIRAP_STAY_CALC_NODE_REGISTRY } from '../mirap-stay-calc/node-registry';
import {
  MIRAP_MMSI_DIFFERENCE_NODE_REGISTRY,
  MIRAP_MMSI_INTERSECTION_NODE_REGISTRY,
  MIRAP_MMSI_UNION_NODE_REGISTRY,
} from '../mirap-mmsi-set/node-registry';
import { MIRAP_MMSI_EXTRACTOR_NODE_REGISTRY } from '../mirap-mmsi-extractor/node-registry';
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
vi.mock('@coze-workflow/variable', () => ({
  WorkflowBatchService: Symbol('WorkflowBatchService'),
  WorkflowVariableService: Symbol('WorkflowVariableService'),
  variableUtils: {
    dtoMetaToViewMeta: (value: unknown) => value,
    inputValueToDTO: (value: unknown) => value,
    inputValueToVO: (value: unknown) => value,
    viewMetaToDTOMeta: (value: unknown) => value,
  },
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
vi.mock('../mirap-mmsi-extractor/form-meta', () => ({
  MMSI_EXTRACTOR_FORM_META: {},
}));

describe('Mirap node registry persistence contract', () => {
  const registries = [
    MIRAP_AREA_SHIP_NODE_REGISTRY,
    MIRAP_STAY_CALC_NODE_REGISTRY,
    MIRAP_HOVER_DETAIL_NODE_REGISTRY,
    MIRAP_MMSI_INTERSECTION_NODE_REGISTRY,
    MIRAP_MMSI_UNION_NODE_REGISTRY,
    MIRAP_MMSI_DIFFERENCE_NODE_REGISTRY,
    MIRAP_MMSI_EXTRACTOR_NODE_REGISTRY,
  ];

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
    [MIRAP_MMSI_EXTRACTOR_NODE_REGISTRY, StandardNodeType.MirapMMSIExtractor],
  ])('keeps registry type and nodeDTOType aligned', (registry, nodeType) => {
    expect(registry.type).toBe(nodeType);
    expect(registry.meta.nodeDTOType).toBe(nodeType);
  });

  it.each(registries)(
    'restores $type through the production schema save and reopen transforms',
    registry => {
      const registryByType = new Map(registries.map(item => [item.type, item]));
      const document = {
        getNodeRegister: (type: StandardNodeType) => registryByType.get(type),
      } as unknown as WorkflowDocument;
      const formatter = new WorkflowJSONFormat();
      Object.defineProperty(formatter, 'playgroundContext', {
        value: { getNodeTemplateInfoByType: () => undefined },
      });
      const canvasNode: WorkflowNodeJSON = {
        id: `node-${registry.type}`,
        type: registry.type,
        meta: { position: { x: 10, y: 20 } },
        data: {
          nodeMeta: { title: `node-${registry.type}` },
          mirapPersistenceMarker: registry.type,
        },
      };

      const submitted = formatter.formatNodeOnSubmit(
        structuredClone(canvasNode),
        document,
        {} as WorkflowNodeEntity,
      );
      const persistedSchema = JSON.parse(
        JSON.stringify({ nodes: [submitted], edges: [] }),
      );
      const reopened = formatter.formatOnInit(persistedSchema, document);
      const restoredNode = reopened.nodes[0];
      const restoredRegistry = document.getNodeRegister(restoredNode.type);

      expect(restoredRegistry).toBe(registry);
      expect(restoredNode.data?.mirapPersistenceMarker).toBe(registry.type);
    },
  );
});
