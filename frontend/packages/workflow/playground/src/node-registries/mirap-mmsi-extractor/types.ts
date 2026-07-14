/*
 * Copyright 2025 coze-dev Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import type { InputValueVO, ViewVariableType } from '@coze-workflow/base';

export interface FormData {
  inputs: { inputParameters: InputValueVO[]; [key: string]: unknown };
  outputs: Array<{ key?: string; name: string; type: ViewVariableType }>;
}
