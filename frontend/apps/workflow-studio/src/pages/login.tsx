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

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<void>;
}

export function LoginPage({ onSignIn }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await onSignIn(email.trim(), password);
    } catch (err) {
      setPassword('');
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-panel">
        <div>
          <p className="eyebrow">算子工作流</p>
          <h1>登录工作空间</h1>
          <p className="login-copy">
            使用已有账号的邮箱和密码登录。当前暂不支持注册新账号。
          </p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            邮箱
            <input
              type="email"
              name="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="username"
              inputMode="email"
              autoFocus
              required
            />
          </label>
          <label>
            密码
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                onClick={() => setShowPassword(value => !value)}
              >
                {showPassword ? '隐藏' : '显示'}
              </button>
            </span>
          </label>
          {error ? (
            <div className="error-message" role="alert">
              {error}
            </div>
          ) : null}
          <button
            className="primary-button"
            type="submit"
            disabled={submitting}
          >
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>
      </section>
    </div>
  );
}
