/*
 * Copyright 2025 coze-dev Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { FlowNodeFormData } from '@flowgram-adapter/free-layout-editor';

import {
  generateParametersToProperties,
  type NodeTestMeta,
} from '@/test-run-kit';

export const test: NodeTestMeta = {
  generateFormInputProperties(node) {
    const formData = node
      .getData(FlowNodeFormData)
      .formModel.getFormItemValueByPath('/');
    return generateParametersToProperties(
      (formData?.inputs?.inputParameters ?? []).map(item => ({
        name: item.name,
        title: item.name,
        required: true,
        input: item.input,
      })),
      { node },
    );
  },
};
