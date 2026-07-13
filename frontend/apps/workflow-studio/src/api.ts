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

interface ReleasedWorkflowData {
  workflow_list?: ReleasedWorkflowItem[];
  total?: number | string;
}

const DEFAULT_ICON_URI = 'default_icon/default_workflow_icon.png';

function toWorkflowSession(user: AuthUser): WorkflowSession {
  return {
    userId: user.user_id,
    userName: user.name,
    spaceId: user.space_id,
  };
}

async function readApiResponse<T>(response: Response, path: string) {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || (payload.code ?? 0) !== 0) {
    throw new Error(payload.msg || payload.error || `Request failed: ${path}`);
  }
  return payload.data as T;
}

async function postJson<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
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
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return toWorkflowSession(await readApiResponse<AuthUser>(response, path));
}

export async function restoreSession() {
  const path = '/api/auth/session';
  const response = await fetch(path, {
    method: 'GET',
    credentials: 'include',
  });
  return toWorkflowSession(await readApiResponse<AuthUser>(response, path));
}

export async function logout() {
  const path = '/api/auth/logout';
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
  });
  await readApiResponse<undefined>(response, path);
}

export async function getHealth() {
  const response = await fetch('/healthz', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Workflow server is not healthy');
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
