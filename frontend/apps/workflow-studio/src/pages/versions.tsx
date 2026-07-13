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

import { Link, useParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';

import type { ReleasedWorkflowItem } from '../types';
import { useWorkflowSession } from '../session-context';
import { listReleasedWorkflows } from '../api';

function formatTime(value: ReleasedWorkflowItem['update_time']) {
  if (!value) {
    return '-';
  }

  const numeric = Number(value);
  const date = new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

export function VersionsPage() {
  const { session } = useWorkflowSession();
  const { workflowId } = useParams();
  const [versions, setVersions] = useState<ReleasedWorkflowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadVersions = useCallback(async () => {
    if (!session || !workflowId) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await listReleasedWorkflows(session, workflowId);
      setVersions(result.workflows);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载版本列表失败');
    } finally {
      setLoading(false);
    }
  }, [session, workflowId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  return (
    <section className="page-surface">
      <div className="page-header">
        <div>
          <p className="eyebrow">已发布版本</p>
          <h1>工作流 {workflowId}</h1>
        </div>
        <Link className="secondary-link" to={`/workflows/${workflowId}`}>
          打开编辑器
        </Link>
      </div>

      {error ? <div className="error-message">{error}</div> : null}
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>版本</th>
              <th>描述</th>
              <th>提交记录</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version, index) => (
              <tr key={`${version.workflow_id}-${version.commit_id}-${index}`}>
                <td>{version.flow_version || version.version || '-'}</td>
                <td>
                  {version.flow_version_desc ||
                    version.latest_flow_version_desc ||
                    '-'}
                </td>
                <td>{version.commit_id || '-'}</td>
                <td>
                  {formatTime(version.update_time || version.create_time)}
                </td>
              </tr>
            ))}
            {!loading && versions.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={4}>
                  暂无已发布版本
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {loading ? (
          <div className="table-loading">正在加载版本…</div>
        ) : null}
      </div>
    </section>
  );
}
