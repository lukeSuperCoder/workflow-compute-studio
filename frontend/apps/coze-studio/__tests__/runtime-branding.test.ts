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

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('runtime branding', () => {
  it('uses the operator workflow title in the Rsbuild output', () => {
    const config = fs.readFileSync(
      path.resolve(__dirname, '../rsbuild.config.ts'),
      'utf8',
    );

    expect(config).toContain("title: '算子工作流'");
    expect(config).not.toContain("title: '扣子 Studio'");
  });

  it('prevents shared layouts from replacing page-specific document titles', () => {
    const globalLayout = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../packages/foundation/layout/src/components/global-layout/index.tsx',
      ),
      'utf8',
    );

    expect(globalLayout.match(/<Layout\b[^>]*\bkeepDocTitle\b/g)).toHaveLength(2);
  });

  it('wires the document language to initial and later i18n changes', () => {
    const entry = fs.readFileSync(
      path.resolve(__dirname, '../src/index.tsx'),
      'utf8',
    );

    expect(entry).toContain('syncDocumentLanguage(initialLanguage');
    expect(entry).toContain('watchDocumentLanguage(');
  });
});
