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

import { describe, expect, it } from 'vitest';

import zhCN from '../src/locales/zh-CN.json';
import en from '../src/locales/en.json';

describe('operator workflow visible branding', () => {
  it('uses the operator workflow name in Chinese', () => {
    expect(zhCN.platform_name).toBe('算子工作流');
    expect(zhCN.open_source_login_welcome).toBe('欢迎使用算子工作流');
    expect(zhCN.workflow_error_sys).toBe(
      '算子工作流遇到了一些问题，请稍后再试。',
    );
    expect(zhCN.workflow_detail_node_workflows_max).toBe(
      '最多显示 {number} 条最近修改的工作流',
    );
  });

  it('does not restore Coze branding in English', () => {
    expect(en.platform_name).toBe('算子工作流');
    expect(en.open_source_login_welcome).toBe('Welcome to 算子工作流');
    expect(en.workflow_error_sys).toBe(
      '算子工作流 is experiencing some issues. Please try again later.',
    );
  });
});
