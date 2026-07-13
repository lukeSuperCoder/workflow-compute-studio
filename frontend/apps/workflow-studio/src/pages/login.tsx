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

import { useState, type FormEvent } from 'react';

import type { WorkflowSession } from '../types';
import { getHealth } from '../api';

interface LoginPageProps {
  onSignIn: (session: Partial<WorkflowSession>) => void;
}

export function LoginPage({ onSignIn }: LoginPageProps) {
  const [userName, setUserName] = useState('Workflow Developer');
  const [spaceId, setSpaceId] = useState('999999');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setError('');

    try {
      await getHealth();
      onSignIn({
        userName: userName.trim() || 'Workflow Developer',
        spaceId: spaceId.trim() || '999999',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach server');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Mirap Workflow Studio</p>
          <h1>Workflow-only workspace</h1>
          <p className="login-copy">
            Connect to the local workflow server and open the reduced workflow
            surface.
          </p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Display name
            <input
              value={userName}
              onChange={event => setUserName(event.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            Space ID
            <input
              value={spaceId}
              onChange={event => setSpaceId(event.target.value)}
              inputMode="numeric"
            />
          </label>
          {error ? <div className="error-message">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={checking}>
            {checking ? 'Checking...' : 'Enter studio'}
          </button>
        </form>
      </section>
    </div>
  );
}
