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

import { afterEach, describe, expect, it, vi } from 'vitest';

import { login, logout, restoreSession } from '../src/api';

const authPayload = {
  code: 0,
  data: {
    user_id: '42',
    name: 'Luke',
    email: 'luke@example.com',
    space_id: '3',
    space_name: 'Personal Space',
  },
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('workflow auth API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs in with credentials and maps display session data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(authPayload));
    vi.stubGlobal('fetch', fetchMock);

    await expect(login('luke@example.com', 'secret')).resolves.toEqual({
      userId: '42',
      userName: 'Luke',
      spaceId: '3',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: 'luke@example.com', password: 'secret' }),
    });
  });

  it('restores the cookie-backed session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(authPayload));
    vi.stubGlobal('fetch', fetchMock);

    await expect(restoreSession()).resolves.toEqual({
      userId: '42',
      userName: 'Luke',
      spaceId: '3',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    });
  });

  it('logs out through the server session endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code: 0 }));
    vi.stubGlobal('fetch', fetchMock);

    await logout();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('surfaces the safe server error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { code: 401, msg: 'Email or password is incorrect' },
            401,
          ),
        ),
    );

    await expect(login('luke@example.com', 'wrong')).rejects.toThrow(
      'Email or password is incorrect',
    );
  });
});
