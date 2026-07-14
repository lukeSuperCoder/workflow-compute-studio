/*
 * Copyright 2025 coze-dev Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import {
  ValidateTrigger,
  type FormMetaV2,
} from '@flowgram-adapter/free-layout-editor';
import { ValueExpression, type InputValueVO } from '@coze-workflow/base';

import { nodeMetaValidate } from '@/nodes-v2/materials/node-meta-validate';
import {
  fireNodeTitleChange,
  provideNodeOutputVariablesEffect,
} from '@/node-registries/common/effects';

import type { FormData } from './types';
import { FormRender } from './form';
import { transformOnInit, transformOnSubmit } from './data-transformer';
import { INPUT_PATH } from './constants';

export const MMSI_EXTRACTOR_FORM_META: FormMetaV2<FormData> = {
  render: () => <FormRender />,
  validateTrigger: ValidateTrigger.onChange,
  validate: {
    nodeMeta: nodeMetaValidate,
    [INPUT_PATH]: params => {
      const value = params.value as InputValueVO[];
      if (!Array.isArray(value) || value.length === 0) {
        return '请至少选择一个输入结果集';
      }
      if (value.some(item => ValueExpression.isEmpty(item?.input))) {
        return '请选择上游对象数组结果集';
      }
    },
  },
  effect: {
    nodeMeta: fireNodeTitleChange,
    outputs: provideNodeOutputVariablesEffect,
  },
  formatOnInit: transformOnInit,
  formatOnSubmit: transformOnSubmit,
};
