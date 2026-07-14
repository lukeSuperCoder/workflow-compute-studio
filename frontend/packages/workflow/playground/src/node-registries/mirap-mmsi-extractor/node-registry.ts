/*
 * Copyright 2025 coze-dev Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import {
  DEFAULT_NODE_META_PATH,
  DEFAULT_OUTPUTS_PATH,
} from '@coze-workflow/nodes';
import {
  StandardNodeType,
  type WorkflowNodeRegistry,
} from '@coze-workflow/base';

import type { NodeTestMeta } from '@/test-run-kit';

import { test } from './node-test';
import { MMSI_EXTRACTOR_FORM_META } from './form-meta';
import { INPUT_PATH } from './constants';

export const MIRAP_MMSI_EXTRACTOR_NODE_REGISTRY: WorkflowNodeRegistry<NodeTestMeta> =
  {
    type: StandardNodeType.MirapMMSIExtractor,
    meta: {
      nodeDTOType: StandardNodeType.MirapMMSIExtractor,
      size: { width: 360, height: 130.7 },
      nodeMetaPath: DEFAULT_NODE_META_PATH,
      outputsPath: DEFAULT_OUTPUTS_PATH,
      inputParametersPath: INPUT_PATH,
      test,
    },
    variablesMeta: {
      inputsPathList: [INPUT_PATH],
      outputsPathList: ['outputs'],
    },
    formMeta: MMSI_EXTRACTOR_FORM_META,
  };
