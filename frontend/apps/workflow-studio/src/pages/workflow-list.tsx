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
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflows,
  updateWorkflow,
} from '../api';

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

// The page intentionally keeps list loading and the three related CRUD dialogs
// together so each mutation refreshes the same query and error state.
// eslint-disable-next-line @coze-arch/max-line-per-function
export function WorkflowListPage() {
  const { session } = useWorkflowSession();
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowItem | null>(
    null,
  );
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowItem | null>(
    null,
  );
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
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

  const openEditDialog = (workflow: WorkflowItem) => {
    setEditingWorkflow(workflow);
    setEditName(workflow.name || '');
    setEditDesc(workflow.desc || '');
  };

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault();
    const workflowId = editingWorkflow?.workflow_id;
    if (!effectiveSession || !workflowId || !editName.trim()) {
      return;
    }

    setUpdating(true);
    setError('');
    try {
      await updateWorkflow(effectiveSession, workflowId, {
        name: editName.trim(),
        desc: editDesc.trim(),
      });
      setEditingWorkflow(null);
      await loadWorkflows(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : '编辑工作流失败');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    const workflowId = deletingWorkflow?.workflow_id;
    if (!effectiveSession || !workflowId) {
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await deleteWorkflow(effectiveSession, workflowId);
      setDeletingWorkflow(null);
      await loadWorkflows(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除工作流失败');
    } finally {
      setDeleting(false);
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

      <WorkflowTable
        rows={rows}
        loading={loading}
        onEdit={openEditDialog}
        onDelete={setDeletingWorkflow}
      />

      {createOpen ? (
        <WorkflowFormDialog
          title="创建工作流"
          submitText="创建"
          pendingText="创建中…"
          name={name}
          desc={desc}
          pending={creating}
          onNameChange={setName}
          onDescChange={setDesc}
          onCancel={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      ) : null}

      {editingWorkflow ? (
        <WorkflowFormDialog
          title="编辑工作流"
          submitText="保存"
          pendingText="保存中…"
          name={editName}
          desc={editDesc}
          pending={updating}
          onNameChange={setEditName}
          onDescChange={setEditDesc}
          onCancel={() => setEditingWorkflow(null)}
          onSubmit={handleUpdate}
        />
      ) : null}

      {deletingWorkflow ? (
        <DeleteWorkflowDialog
          workflow={deletingWorkflow}
          deleting={deleting}
          onCancel={() => setDeletingWorkflow(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </section>
  );
}

function WorkflowTable({
  rows,
  loading,
  onEdit,
  onDelete,
}: {
  rows: Array<WorkflowItem & { id: string }>;
  loading: boolean;
  onEdit: (workflow: WorkflowItem) => void;
  onDelete: (workflow: WorkflowItem) => void;
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
            <th>操作</th>
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
                <div className="row-actions-inner">
                  <Link to={`/workflows/${workflow.id}`}>打开</Link>
                  <Link to={`/workflows/${workflow.id}/versions`}>版本</Link>
                  <button
                    className="text-action-button"
                    type="button"
                    onClick={() => onEdit(workflow)}
                  >
                    编辑
                  </button>
                  <button
                    className="text-action-button danger-text"
                    type="button"
                    onClick={() => onDelete(workflow)}
                  >
                    删除
                  </button>
                </div>
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
      {loading ? <div className="table-loading">正在加载工作流…</div> : null}
    </div>
  );
}

function WorkflowFormDialog({
  title,
  submitText,
  pendingText,
  name,
  desc,
  pending,
  onNameChange,
  onDescChange,
  onCancel,
  onSubmit,
}: {
  title: string;
  submitText: string;
  pendingText: string;
  name: string;
  desc: string;
  pending: boolean;
  onNameChange: (value: string) => void;
  onDescChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const titleId = 'workflow-form-dialog-title';
  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={onSubmit}
      >
        <h2 id={titleId}>{title}</h2>
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
            disabled={pending || !name.trim()}
          >
            {pending ? pendingText : submitText}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteWorkflowDialog({
  workflow,
  deleting,
  onCancel,
  onConfirm,
}: {
  workflow: WorkflowItem;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = 'delete-workflow-dialog-title';
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="danger-icon" aria-hidden="true">
          !
        </div>
        <div>
          <h2 id={titleId}>删除工作流</h2>
          <p className="confirm-copy">
            确定删除“{workflow.name || workflow.workflow_id}
            ”吗？删除后将无法恢复。
          </p>
        </div>
        <div className="modal-actions">
          <button
            className="ghost-button"
            type="button"
            disabled={deleting}
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}
