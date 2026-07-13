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

import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { lazy, useEffect } from 'react';

import { useWorkflowSession } from '../session-context';

const WorkflowPage = lazy(async () => {
  const [{ ensureWorkflowRuntime }, { installWorkflowApiMocks }] =
    await Promise.all([
      import('../workflow-runtime'),
      import('../workflow-api-mocks'),
    ]);

  ensureWorkflowRuntime();
  installWorkflowApiMocks();

  const module = await import('@coze-workflow/playground-adapter');

  return {
    default: module.WorkflowPage,
  };
});

export function WorkflowEditorRoute() {
  const { session } = useWorkflowSession();
  const { workflowId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session || !workflowId) {
      return;
    }

    const params = new URLSearchParams(location.search);
    let changed = false;
    if (params.get('workflow_id') !== workflowId) {
      params.set('workflow_id', workflowId);
      changed = true;
    }
    if (params.get('space_id') !== session.spaceId) {
      params.set('space_id', session.spaceId);
      changed = true;
    }

    if (changed) {
      navigate(
        {
          pathname: location.pathname,
          search: params.toString(),
        },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate, session, workflowId]);

  if (!session || !workflowId) {
    return null;
  }

  const params = new URLSearchParams(location.search);
  if (
    params.get('workflow_id') !== workflowId ||
    params.get('space_id') !== session.spaceId
  ) {
    return <div className="loading-screen">Opening workflow...</div>;
  }

  return (
    <div className="editor-route">
      <WorkflowPage />
    </div>
  );
}
