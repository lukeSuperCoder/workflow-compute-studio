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

import {
  createWorkflow,
  getHealth,
  listReleasedWorkflows,
  listWorkflows,
  login,
  logout,
  restoreSession,
} from '../src/api';

const session = {
  userId: '42',
  userName: 'Luke',
  spaceId: '3',
};

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

  it('translates the backend invalid-credentials error', async () => {
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
      '邮箱或密码错误',
    );
  });

  it('normalizes a rejected network request for workflow lists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(listWorkflows(session)).rejects.toThrow(
      '无法连接到工作流服务，请检查网络后重试',
    );
  });

  it('normalizes a non-JSON create response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>Bad gateway</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    await expect(
      createWorkflow(session, { name: '测试工作流', desc: '描述' }),
    ).rejects.toThrow('工作流服务返回了无法识别的响应，请稍后重试');
  });

  it('keeps a usable Chinese server error for released workflow versions', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ code: 403, msg: '没有权限查看该工作流' }, 403),
        ),
    );

    await expect(listReleasedWorkflows(session, '123')).rejects.toThrow(
      '没有权限查看该工作流',
    );
  });

  it('uses a Chinese fallback when an API response has no error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ code: 500 }, 500)),
    );

    await expect(login('luke@example.com', 'wrong')).rejects.toThrow(
      '请求失败：/api/auth/login',
    );
  });

  it('uses a Chinese health-check error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    await expect(getHealth()).rejects.toThrow('工作流服务当前不可用');
  });
});
