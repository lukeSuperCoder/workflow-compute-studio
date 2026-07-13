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

import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import type { WorkflowItem } from '../types';
import { useWorkflowSession } from '../session-context';
import { createWorkflow, listWorkflows } from '../api';

function formatTime(value: WorkflowItem['update_time']) {
  if (!value) {
    return '-';
  }

  const numeric = Number(value);
  const date = new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function statusText(status?: number) {
  switch (status) {
    case 1:
      return 'Draft blocked';
    case 2:
      return 'Ready';
    case 3:
      return 'Published';
    case 4:
      return 'Deleted';
    default:
      return 'Draft';
  }
}

export function WorkflowListPage() {
  const { session } = useWorkflowSession();
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const effectiveSession = useMemo(
    () =>
      session ? { ...session, spaceId: spaceId || session.spaceId } : null,
    [session, spaceId],
  );

  const loadWorkflows = useCallback(
    async (nameFilter = query) => {
      if (!effectiveSession) {
        return;
      }

      setLoading(true);
      setError('');
      try {
        const result = await listWorkflows(effectiveSession, nameFilter);
        setWorkflows(result.workflows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load list');
      } finally {
        setLoading(false);
      }
    },
    [effectiveSession, query],
  );

  useEffect(() => {
    void loadWorkflows('');
  }, [loadWorkflows]);

  const rows = useMemo(
    () =>
      workflows.map(workflow => ({
        ...workflow,
        id: workflow.workflow_id || '',
      })),
    [workflows],
  );

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    void loadWorkflows(query);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!effectiveSession || !name.trim()) {
      return;
    }

    setCreating(true);
    setError('');
    try {
      const created = await createWorkflow(effectiveSession, {
        name: name.trim(),
        desc: desc.trim() || 'Mirap workflow',
      });
      setCreateOpen(false);
      setName('');
      setDesc('');
      await loadWorkflows('');
      if (created.workflow_id) {
        navigate(
          `/workflows/${created.workflow_id}?workflow_id=${created.workflow_id}&space_id=${effectiveSession.spaceId}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="page-surface">
      <div className="page-header">
        <div>
          <p className="eyebrow">Workflow Library</p>
          <h1>Workflows</h1>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setCreateOpen(true)}
        >
          New workflow
        </button>
      </div>

      <form className="toolbar" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search workflows"
        />
        <button className="secondary-button" type="submit">
          Search
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            setQuery('');
            void loadWorkflows('');
          }}
        >
          Refresh
        </button>
      </form>

      {error ? <div className="error-message">{error}</div> : null}

      <WorkflowTable rows={rows} loading={loading} />

      {createOpen ? (
        <CreateWorkflowDialog
          name={name}
          desc={desc}
          creating={creating}
          onNameChange={setName}
          onDescChange={setDesc}
          onCancel={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      ) : null}
    </section>
  );
}

function WorkflowTable({
  rows,
  loading,
}: {
  rows: Array<WorkflowItem & { id: string }>;
  loading: boolean;
}) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Workflow</th>
            <th>Status</th>
            <th>Updated</th>
            <th>Owner</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(workflow => (
            <tr key={workflow.id}>
              <td>
                <div className="workflow-cell">
                  {workflow.url ? (
                    <img src={workflow.url} alt="" />
                  ) : (
                    <span className="workflow-avatar">W</span>
                  )}
                  <div>
                    <Link to={`/workflows/${workflow.id}`}>
                      {workflow.name || workflow.id}
                    </Link>
                    <p>{workflow.desc || 'No description'}</p>
                  </div>
                </div>
              </td>
              <td>
                <span className="status-pill">
                  {statusText(workflow.status)}
                </span>
              </td>
              <td>
                {formatTime(workflow.update_time || workflow.create_time)}
              </td>
              <td>{workflow.creator?.name || '-'}</td>
              <td className="row-actions">
                <Link to={`/workflows/${workflow.id}`}>Open</Link>
                <Link to={`/workflows/${workflow.id}/versions`}>Versions</Link>
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 ? (
            <tr>
              <td className="empty-state" colSpan={5}>
                No workflows yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {loading ? (
        <div className="table-loading">Loading workflows...</div>
      ) : null}
    </div>
  );
}

function CreateWorkflowDialog({
  name,
  desc,
  creating,
  onNameChange,
  onDescChange,
  onCancel,
  onSubmit,
}: {
  name: string;
  desc: string;
  creating: boolean;
  onNameChange: (value: string) => void;
  onDescChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={onSubmit}>
        <h2>Create workflow</h2>
        <label>
          Name
          <input
            value={name}
            onChange={event => onNameChange(event.target.value)}
            required
            maxLength={100}
            autoFocus
          />
        </label>
        <label>
          Description
          <textarea
            value={desc}
            onChange={event => onDescChange(event.target.value)}
            maxLength={600}
            rows={4}
          />
        </label>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={creating || !name.trim()}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
