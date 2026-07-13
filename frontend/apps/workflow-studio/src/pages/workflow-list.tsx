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
      return '草稿受阻';
    case 2:
      return '已就绪';
    case 3:
      return '已发布';
    case 4:
      return '已删除';
    default:
      return '草稿';
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
        setError(err instanceof Error ? err.message : '加载工作流列表失败');
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
        desc: desc.trim() || '算子工作流',
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
      setError(err instanceof Error ? err.message : '创建工作流失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="page-surface">
      <div className="page-header">
        <div>
          <p className="eyebrow">工作流库</p>
          <h1>工作流</h1>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setCreateOpen(true)}
        >
          新建工作流
        </button>
      </div>

      <form className="toolbar" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="搜索工作流"
        />
        <button className="secondary-button" type="submit">
          搜索
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            setQuery('');
            void loadWorkflows('');
          }}
        >
          刷新
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
            <th>工作流</th>
            <th>状态</th>
            <th>更新时间</th>
            <th>创建人</th>
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
                    <span className="workflow-avatar">流</span>
                  )}
                  <div>
                    <Link to={`/workflows/${workflow.id}`}>
                      {workflow.name || workflow.id}
                    </Link>
                    <p>{workflow.desc || '暂无描述'}</p>
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
                <Link to={`/workflows/${workflow.id}`}>打开</Link>
                <Link to={`/workflows/${workflow.id}/versions`}>版本</Link>
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 ? (
            <tr>
              <td className="empty-state" colSpan={5}>
                暂无工作流
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {loading ? (
        <div className="table-loading">正在加载工作流…</div>
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
        <h2>创建工作流</h2>
        <label>
          名称
          <input
            value={name}
            onChange={event => onNameChange(event.target.value)}
            required
            maxLength={100}
            autoFocus
          />
        </label>
        <label>
          描述
          <textarea
            value={desc}
            onChange={event => onDescChange(event.target.value)}
            maxLength={600}
            rows={4}
          />
        </label>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={creating || !name.trim()}
          >
            {creating ? '创建中…' : '创建'}
          </button>
        </div>
      </form>
    </div>
  );
}
