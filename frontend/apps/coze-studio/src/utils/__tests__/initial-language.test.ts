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

import * as initialLanguage from '../initial-language';
import { getInitialLanguage } from '../initial-language';

describe('getInitialLanguage', () => {
  it('defaults to zh-CN without a saved preference', () => {
    expect(getInitialLanguage({ getItem: () => null })).toBe('zh-CN');
  });

  it('preserves saved language preferences', () => {
    expect(getInitialLanguage({ getItem: () => 'en' })).toBe('en');
    expect(getInitialLanguage({ getItem: () => 'zh-CN' })).toBe('zh-CN');
  });
});

describe('document language synchronization', () => {
  it('sets the document language to English', () => {
    const documentElement = { lang: 'zh-CN' };

    initialLanguage.syncDocumentLanguage('en', documentElement);

    expect(documentElement.lang).toBe('en');
  });

  it('sets the document language to Simplified Chinese', () => {
    const documentElement = { lang: 'en' };

    initialLanguage.syncDocumentLanguage('zh-CN', documentElement);

    expect(documentElement.lang).toBe('zh-CN');
  });

  it('updates the document after a later language change', () => {
    const documentElement = { lang: 'zh-CN' };
    let listener: ((language: 'en' | 'zh-CN') => void) | undefined;
    const source = {
      on: (
        _event: 'languageChanged',
        nextListener: (language: 'en' | 'zh-CN') => void,
      ) => {
        listener = nextListener;
      },
    };

    initialLanguage.watchDocumentLanguage(source, documentElement);
    listener?.('en');

    expect(documentElement.lang).toBe('en');
  });
});
