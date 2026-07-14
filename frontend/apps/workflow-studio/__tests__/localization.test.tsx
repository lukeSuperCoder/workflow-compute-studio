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

import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';

import { SessionContext } from '../src/session-context';
import { WorkflowListPage } from '../src/pages/workflow-list';
import { VersionsPage } from '../src/pages/versions';
import { LoginPage } from '../src/pages/login';
import { App } from '../src/app';

const apiMocks = vi.hoisted(() => ({
  createWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  listReleasedWorkflows: vi.fn(),
  listWorkflows: vi.fn(),
  restoreSession: vi.fn(),
  updateWorkflow: vi.fn(),
}));

vi.mock('../src/api', () => apiMocks);

const session = {
  userId: '42',
  userName: '测试用户',
  spaceId: '3',
};

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function changeTextArea(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('workflow-studio 中文界面', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
    apiMocks.listWorkflows.mockResolvedValue({ workflows: [], total: 0 });
    apiMocks.listReleasedWorkflows.mockResolvedValue({
      workflows: [],
      total: 0,
    });
    apiMocks.restoreSession.mockResolvedValue(session);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('登录页使用算子工作流品牌和自然中文表单文案', () => {
    act(() => root.render(<LoginPage onSignIn={vi.fn()} />));

    expect(container.querySelector('.eyebrow')?.textContent).toBe('算子工作流');
    expect(container.querySelector('h1')?.textContent).toBe('登录工作空间');
    expect(container.textContent).toContain('使用已有账号的邮箱和密码登录');
    expect(container.querySelector('label')?.textContent).toContain('邮箱');
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.textContent,
    ).toBe('登录');
  });

  it('应用壳使用中文品牌、空间和恢复状态文案', async () => {
    window.history.replaceState({}, '', '/');
    act(() => root.render(<App />));
    expect(container.textContent).toBe('正在恢复登录状态…');

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('.brand span:last-child')?.textContent).toBe(
      '算子工作流',
    );
    expect(container.textContent).toContain('空间 3');
    expect(container.textContent).toContain('退出登录');
  });

  it('工作流列表和创建弹窗使用中文文案', async () => {
    apiMocks.listWorkflows.mockResolvedValue({
      workflows: [
        {
          workflow_id: 'blocked-draft',
          name: '待处理工作流',
          status: 1,
        },
      ],
      total: 1,
    });
    await act(async () => {
      root.render(
        <SessionContext.Provider
          value={{ session, signIn: vi.fn(), signOut: vi.fn() }}
        >
          <MemoryRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <WorkflowListPage />
          </MemoryRouter>
        </SessionContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('h1')?.textContent).toBe('工作流');
    expect(container.textContent).toContain('草稿受阻');
    const createButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === '新建工作流',
    );
    expect(createButton).toBeDefined();

    act(() => createButton?.click());
    expect(container.querySelector('.modal h2')?.textContent).toBe(
      '创建工作流',
    );
    expect(container.querySelector('.modal')?.textContent).toContain('描述');
    expect(container.querySelector('.modal')?.textContent).toContain('取消');

    apiMocks.createWorkflow.mockResolvedValue({});
    const nameInput = container.querySelector<HTMLInputElement>('.modal input');
    await act(async () => {
      if (!nameInput) {
        throw new Error('缺少工作流名称输入框');
      }
      changeInput(nameInput, '测试工作流');
      container
        .querySelector<HTMLFormElement>('.modal')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      await Promise.resolve();
    });
    expect(apiMocks.createWorkflow).toHaveBeenCalledWith(session, {
      name: '测试工作流',
      desc: '算子工作流',
    });
  });

  it('工作流列表操作列保持表格布局并显示表头', async () => {
    apiMocks.listWorkflows.mockResolvedValue({
      workflows: [
        {
          workflow_id: 'workflow-1',
          name: '测试工作流',
        },
      ],
      total: 1,
    });

    await act(async () => {
      root.render(
        <SessionContext.Provider
          value={{ session, signIn: vi.fn(), signOut: vi.fn() }}
        >
          <MemoryRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <WorkflowListPage />
          </MemoryRouter>
        </SessionContext.Provider>,
      );
      await Promise.resolve();
    });

    const headers = Array.from(container.querySelectorAll('thead th'));
    expect(headers.at(-1)?.textContent).toBe('操作');

    const actionCell = container.querySelector('tbody td.row-actions');
    expect(
      actionCell?.querySelector(':scope > .row-actions-inner'),
    ).not.toBeNull();
    expect(actionCell?.textContent).toContain('编辑');
    expect(actionCell?.textContent).toContain('删除');
  });

  it('可以编辑工作流名称和描述并确认删除', async () => {
    apiMocks.listWorkflows.mockResolvedValue({
      workflows: [
        {
          workflow_id: 'workflow-1',
          name: '原名称',
          desc: '原描述',
        },
      ],
      total: 1,
    });
    apiMocks.updateWorkflow.mockResolvedValue(undefined);
    apiMocks.deleteWorkflow.mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <SessionContext.Provider
          value={{ session, signIn: vi.fn(), signOut: vi.fn() }}
        >
          <MemoryRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <WorkflowListPage />
          </MemoryRouter>
        </SessionContext.Provider>,
      );
      await Promise.resolve();
    });

    const findButton = (text: string) =>
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === text,
      );

    act(() => findButton('编辑')?.click());
    expect(container.querySelector('.modal h2')?.textContent).toBe(
      '编辑工作流',
    );

    const editName = container.querySelector<HTMLInputElement>('.modal input');
    const editDesc =
      container.querySelector<HTMLTextAreaElement>('.modal textarea');
    await act(async () => {
      if (!editName || !editDesc) {
        throw new Error('缺少编辑工作流表单');
      }
      changeInput(editName, '新名称');
      changeTextArea(editDesc, '新描述');
      container
        .querySelector<HTMLFormElement>('.modal')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      await Promise.resolve();
    });
    expect(apiMocks.updateWorkflow).toHaveBeenCalledWith(
      session,
      'workflow-1',
      { name: '新名称', desc: '新描述' },
    );

    act(() => findButton('删除')?.click());
    expect(container.querySelector('.confirm-copy')?.textContent).toContain(
      '原名称',
    );

    await act(async () => {
      findButton('确认删除')?.click();
      await Promise.resolve();
    });
    expect(apiMocks.deleteWorkflow).toHaveBeenCalledWith(session, 'workflow-1');
  });

  it('版本页使用中文标题、表头和空状态', async () => {
    await act(async () => {
      root.render(
        <SessionContext.Provider
          value={{ session, signIn: vi.fn(), signOut: vi.fn() }}
        >
          <MemoryRouter
            initialEntries={['/workflows/123/versions']}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <Routes>
              <Route
                path="/workflows/:workflowId/versions"
                element={<VersionsPage />}
              />
            </Routes>
          </MemoryRouter>
        </SessionContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('.eyebrow')?.textContent).toBe('已发布版本');
    expect(container.querySelector('h1')?.textContent).toBe('工作流 123');
    expect(container.textContent).toContain('版本');
    expect(container.textContent).toContain('暂无已发布版本');
    expect(container.textContent).toContain('打开编辑器');
  });

  it('入口 HTML 和构建配置声明中文语言与算子工作流标题', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    const rsbuild = readFileSync(
      resolve(__dirname, '../rsbuild.config.ts'),
      'utf8',
    );

    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain('<title>算子工作流</title>');
    expect(rsbuild).toContain("title: '算子工作流'");
  });

  it('加载与提交状态统一使用中文省略号', () => {
    const sourceFiles = [
      '../src/app.tsx',
      '../src/pages/login.tsx',
      '../src/pages/versions.tsx',
      '../src/pages/workflow-editor-route.tsx',
      '../src/pages/workflow-list.tsx',
    ];

    for (const file of sourceFiles) {
      const source = readFileSync(resolve(__dirname, file), 'utf8');
      expect(source).not.toMatch(/(?:加载|登录|创建|恢复|打开)[^'\n]*\.\.\./);
    }
  });
});
