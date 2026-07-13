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
import { Suspense, lazy, useMemo, useState } from 'react';

import {
  SessionContext,
  useWorkflowSession,
  type SessionContextValue,
} from './session-context';
import { clearSession, createDefaultSession, readSession } from './session';
import { WorkflowListPage } from './pages/workflow-list';
import { VersionsPage } from './pages/versions';
import { LoginPage } from './pages/login';

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
          <span className="brand-mark">M</span>
          <span>Mirap Workflow Studio</span>
        </button>
        <div className="user-menu">
          <span>{session.userName}</span>
          <span className="muted">Space {session.spaceId}</span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              signOut();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
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
      onSignIn={input => {
        signIn(createDefaultSession(input));
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
  const [session, setSession] = useState(() => readSession());
  const contextValue = useMemo<SessionContextValue>(
    () => ({
      session,
      signIn: nextSession => setSession(nextSession),
      signOut: () => {
        clearSession();
        setSession(null);
      },
    }),
    [session],
  );

  return (
    <SessionContext.Provider value={contextValue}>
      <Suspense fallback={<div className="loading-screen">Loading...</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </SessionContext.Provider>
  );
}
