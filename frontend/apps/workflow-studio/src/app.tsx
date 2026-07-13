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

import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useNavigate,
} from 'react-router-dom';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

import {
  SessionContext,
  useWorkflowSession,
  type SessionContextValue,
} from './session-context';
import { clearSession, saveSession } from './session';
import { WorkflowListPage } from './pages/workflow-list';
import { VersionsPage } from './pages/versions';
import { LoginPage } from './pages/login';
import { login, logout, restoreSession } from './api';

const WorkflowEditorRoute = lazy(() =>
  import('./pages/workflow-editor-route').then(module => ({
    default: module.WorkflowEditorRoute,
  })),
);

function AppShell() {
  const { session, signOut } = useWorkflowSession();
  const navigate = useNavigate();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <button className="brand" type="button" onClick={() => navigate('/')}>
          <span className="brand-mark">算</span>
          <span>算子工作流</span>
        </button>
        <div className="user-menu">
          <span>{session.userName}</span>
          <span className="muted">空间 {session.spaceId}</span>
          <button
            className="ghost-button"
            type="button"
            onClick={async () => {
              try {
                await signOut();
              } finally {
                navigate('/login', { replace: true });
              }
            }}
          >
            退出登录
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

function LoginRoute() {
  const { session, signIn } = useWorkflowSession();
  if (session) {
    return <Navigate to="/" replace />;
  }

  return (
    <LoginPage
      onSignIn={async (email, password) => {
        signIn(await login(email, password));
      }}
    />
  );
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginRoute />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <WorkflowListPage />,
      },
      {
        path: 'space/:spaceId/library',
        element: <WorkflowListPage />,
      },
      {
        path: 'workflows/:workflowId',
        element: <WorkflowEditorRoute />,
      },
      {
        path: 'workflows/:workflowId/versions',
        element: <VersionsPage />,
      },
    ],
  },
]);

export function App() {
  const [session, setSession] = useState<SessionContextValue['session']>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then(nextSession => {
        if (active) {
          saveSession(nextSession);
          setSession(nextSession);
        }
      })
      .catch(() => clearSession())
      .finally(() => {
        if (active) {
          setRestoring(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const contextValue = useMemo<SessionContextValue>(
    () => ({
      session,
      signIn: nextSession => {
        saveSession(nextSession);
        setSession(nextSession);
      },
      signOut: async () => {
        try {
          await logout();
        } finally {
          clearSession();
          setSession(null);
        }
      },
    }),
    [session],
  );

  return restoring ? (
    <div className="loading-screen">正在恢复登录状态…</div>
  ) : (
    <SessionContext.Provider value={contextValue}>
      <Suspense fallback={<div className="loading-screen">加载中…</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </SessionContext.Provider>
  );
}
