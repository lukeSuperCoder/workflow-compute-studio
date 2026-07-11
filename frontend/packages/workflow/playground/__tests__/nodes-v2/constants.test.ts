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

import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const constantsSource = readFileSync(
  resolve(__dirname, '../../src/nodes-v2/constants.ts'),
  'utf8',
);

const MIRAP_REGISTRY_NAMES = [
  'START_NODE_REGISTRY',
  'END_NODE_REGISTRY',
  'INPUT_NODE_REGISTRY',
  'OUTPUT_NODE_REGISTRY',
  'IF_NODE_REGISTRY',
  'LOOP_NODE_REGISTRY',
  'BATCH_NODE_REGISTRY',
  'BREAK_NODE_REGISTRY',
  'CONTINUE_NODE_REGISTRY',
  'VARIABLE_ASSIGN_NODE_REGISTRY',
  'SET_VARIABLE_NODE_REGISTRY',
  'VARIABLE_MERGE_NODE_REGISTRY',
  'JSON_STRINGIFY_NODE_REGISTRY',
  'JSON_PARSER_NODE_REGISTRY',
  'TEXT_PROCESS_NODE_REGISTRY',
  'HTTP_NODE_REGISTRY',
  'SUB_WORKFLOW_NODE_REGISTRY',
  'COMMENT_NODE_REGISTRY',
  'MIRAP_AREA_SHIP_NODE_REGISTRY',
  'MIRAP_STAY_CALC_NODE_REGISTRY',
  'MIRAP_HOVER_DETAIL_NODE_REGISTRY',
  'MIRAP_MMSI_INTERSECTION_NODE_REGISTRY',
  'MIRAP_MMSI_UNION_NODE_REGISTRY',
  'MIRAP_MMSI_DIFFERENCE_NODE_REGISTRY',
];

const REMOVED_REGISTRY_NAMES = [
  'LLM_NODE_REGISTRY',
  'PLUGIN_NODE_REGISTRY',
  'CODE_NODE_REGISTRY',
  'DATASET_NODE_REGISTRY',
  'DATASET_WRITE_NODE_REGISTRY',
  'DATABASE_NODE_REGISTRY',
  'DATABASE_CREATE_NODE_REGISTRY',
  'DATABASE_QUERY_NODE_REGISTRY',
  'DATABASE_DELETE_NODE_REGISTRY',
  'DATABASE_UPDATE_NODE_REGISTRY',
  'QUESTION_NODE_REGISTRY',
  'INTENT_NODE_REGISTRY',
  'LTM_NODE_REGISTRY',
  'IMAGE_GENERATE_NODE_REGISTRY',
  'IMAGE_REFERENCE_NODE_REGISTRY',
  'IMAGE_CANVAS_NODE_REGISTRY',
  'TRIGGER_UPSERT_NODE_REGISTRY',
  'TRIGGER_READ_NODE_REGISTRY',
  'TRIGGER_DELETE_NODE_REGISTRY',
];

describe('Mirap NODES_V2 source whitelist', () => {
  it('uses direct whitelist imports instead of the legacy node-registry barrel', () => {
    expect(constantsSource).not.toContain("from '@/node-registries';");
    expect(constantsSource).not.toContain('from "@/node-registries";');
  });

  it('lists every Mirap registry and no removed registry in MIRAP_NODE_REGISTRIES', () => {
    for (const registryName of MIRAP_REGISTRY_NAMES) {
      expect(constantsSource).toContain(registryName);
    }

    for (const registryName of REMOVED_REGISTRY_NAMES) {
      expect(constantsSource).not.toContain(registryName);
    }
  });

  it('keeps unsupported legacy shells outside the Mirap whitelist', () => {
    expect(constantsSource).toContain('UNSUPPORTED_LEGACY_NODE_REGISTRIES');
    expect(constantsSource).toMatch(
      /export const NODES_V2 = \[\s+...MIRAP_NODE_REGISTRIES,\s+...UNSUPPORTED_LEGACY_NODE_REGISTRIES,\s+\];/m,
    );
  });
});
