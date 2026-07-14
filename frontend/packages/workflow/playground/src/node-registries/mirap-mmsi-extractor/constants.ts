/*
 * Copyright 2025 coze-dev Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { nanoid } from 'nanoid';
import { ViewVariableType } from '@coze-workflow/base';

export const INPUT_PATH = 'inputs.inputParameters';
export const OUTPUT_NAME = 'mmsis';
export const arrayObjectOnlyDisabledTypes = ViewVariableType.getComplement([
  ViewVariableType.ArrayObject,
]);
export const createInputName = (index: number) => `dataset_${index + 1}`;
export const createOutputs = (existing: Array<{ key?: string }> = []) => [
  {
    key: existing[0]?.key ?? nanoid(),
    name: OUTPUT_NAME,
    type: ViewVariableType.String,
  },
];
