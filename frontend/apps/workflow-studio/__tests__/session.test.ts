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

import { beforeEach, describe, expect, it } from 'vitest';

import { clearSession, readSession, saveSession } from '../src/session';

describe('workflow display session storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists only non-secret display data', () => {
    saveSession({ userId: '42', userName: 'Luke', spaceId: '3' });

    expect(readSession()).toEqual({
      userId: '42',
      userName: 'Luke',
      spaceId: '3',
    });
    const raw = window.localStorage.getItem('mirap.workflow.session') ?? '';
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      'spaceId',
      'userId',
      'userName',
    ]);
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('session_key');
  });

  it('clears stored display data', () => {
    saveSession({ userId: '42', userName: 'Luke', spaceId: '3' });
    clearSession();
    expect(readSession()).toBeNull();
  });
});
