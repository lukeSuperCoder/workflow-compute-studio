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

import type {
  AuthUser,
  ReleasedWorkflowItem,
  WorkflowItem,
  WorkflowSession,
} from './types';

interface ApiResponse<T> {
  data?: T;
  code?: number;
  msg?: string;
  error?: string;
}

interface WorkflowListData {
  workflow_list?: WorkflowItem[];
  total?: number | string;
}

interface CreateWorkflowData {
  workflow_id?: string;
  name?: string;
  url?: string;
}

interface DeleteWorkflowData {
  status?: number;
}

interface ReleasedWorkflowData {
  workflow_list?: ReleasedWorkflowItem[];
  total?: number | string;
}

const DEFAULT_ICON_URI = 'default_icon/default_workflow_icon.png';
const NETWORK_ERROR_MESSAGE = '无法连接到工作流服务，请检查网络后重试';
const INVALID_RESPONSE_MESSAGE = '工作流服务返回了无法识别的响应，请稍后重试';
const KNOWN_SERVER_ERRORS: Record<string, string> = {
  'email or password is incorrect': '邮箱或密码错误',
};

function toWorkflowSession(user: AuthUser): WorkflowSession {
  return {
    userId: user.user_id,
    userName: user.name,
    spaceId: user.space_id,
  };
}

async function readApiResponse<T>(response: Response, path: string) {
  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  if (!response.ok || (payload.code ?? 0) !== 0) {
    const serverMessage = payload.msg || payload.error;
    const normalizedMessage = serverMessage?.trim();
    const knownMessage = normalizedMessage
      ? KNOWN_SERVER_ERRORS[normalizedMessage.toLowerCase()]
      : undefined;
    const usableChineseMessage =
      normalizedMessage && /[\u3400-\u9fff]/u.test(normalizedMessage)
        ? normalizedMessage
        : undefined;
    throw new Error(
      knownMessage || usableChineseMessage || `请求失败：${path}`,
    );
  }
  return payload.data as T;
}

async function request(path: string, init: RequestInit) {
  try {
    return await fetch(path, init);
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>) {
  const response = await request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  return readApiResponse<T>(response, path);
}

export async function login(email: string, password: string) {
  const path = '/api/auth/login';
  const response = await request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return toWorkflowSession(await readApiResponse<AuthUser>(response, path));
}

export async function restoreSession() {
  const path = '/api/auth/session';
  const response = await request(path, {
    method: 'GET',
    credentials: 'include',
  });
  return toWorkflowSession(await readApiResponse<AuthUser>(response, path));
}

export async function logout() {
  const path = '/api/auth/logout';
  const response = await request(path, {
    method: 'POST',
    credentials: 'include',
  });
  await readApiResponse<undefined>(response, path);
}

export async function getHealth() {
  const response = await request('/healthz', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('工作流服务当前不可用');
  }
}

export async function listWorkflows(session: WorkflowSession, name = '') {
  const data = await postJson<WorkflowListData>(
    '/api/workflow_api/workflow_list',
    {
      page: 1,
      size: 50,
      space_id: session.spaceId,
      name: name || undefined,
      flow_mode: 0,
    },
  );

  return {
    workflows: data?.workflow_list ?? [],
    total: Number(data?.total ?? data?.workflow_list?.length ?? 0),
  };
}

export async function createWorkflow(
  session: WorkflowSession,
  input: { name: string; desc: string },
) {
  const data = await postJson<CreateWorkflowData>('/api/workflow_api/create', {
    space_id: session.spaceId,
    name: input.name,
    desc: input.desc,
    icon_uri: DEFAULT_ICON_URI,
    flow_mode: 0,
    schema_type: 1,
  });

  return data;
}

export async function updateWorkflow(
  session: WorkflowSession,
  workflowId: string,
  input: { name: string; desc: string },
) {
  await postJson<undefined>('/api/workflow_api/update_meta', {
    workflow_id: workflowId,
    space_id: session.spaceId,
    name: input.name,
    desc: input.desc,
  });
}

export async function deleteWorkflow(
  session: WorkflowSession,
  workflowId: string,
) {
  const data = await postJson<DeleteWorkflowData>('/api/workflow_api/delete', {
    workflow_id: workflowId,
    space_id: session.spaceId,
  });

  if (data?.status !== undefined && data.status !== 0) {
    throw new Error('删除工作流失败');
  }
}

export async function listReleasedWorkflows(
  session: WorkflowSession,
  workflowId?: string,
) {
  const data = await postJson<ReleasedWorkflowData>(
    '/api/workflow_api/released_workflows',
    {
      page: 1,
      size: 50,
      space_id: session.spaceId,
      workflow_ids: workflowId ? [workflowId] : undefined,
      flow_mode: 0,
    },
  );

  return {
    workflows: data?.workflow_list ?? [],
    total: Number(data?.total ?? data?.workflow_list?.length ?? 0),
  };
}
