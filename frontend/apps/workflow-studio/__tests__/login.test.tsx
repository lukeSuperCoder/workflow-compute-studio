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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';

import { LoginPage } from '../src/pages/login';

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('LoginPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('submits an existing account email and password', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(<LoginPage onSignIn={onSignIn} />));

    const email =
      container.querySelector<HTMLInputElement>('input[name=email]');
    const password = container.querySelector<HTMLInputElement>(
      'input[name=password]',
    );
    expect(email?.autocomplete).toBe('username');
    expect(password?.autocomplete).toBe('current-password');

    act(() => {
      if (!email || !password) {
        throw new Error('Login fields are missing');
      }
      changeInput(email, 'luke@example.com');
      changeInput(password, 'secret');
      container
        .querySelector<HTMLFormElement>('form')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSignIn).toHaveBeenCalledWith('luke@example.com', 'secret');
  });

  it('clears the password and keeps the email after a failed login', async () => {
    const onSignIn = vi
      .fn()
      .mockRejectedValue(new Error('Email or password is incorrect'));
    act(() => root.render(<LoginPage onSignIn={onSignIn} />));

    const email =
      container.querySelector<HTMLInputElement>('input[name=email]');
    const password = container.querySelector<HTMLInputElement>(
      'input[name=password]',
    );
    act(() => {
      if (!email || !password) {
        throw new Error('Login fields are missing');
      }
      changeInput(email, 'luke@example.com');
      changeInput(password, 'wrong');
      container
        .querySelector<HTMLFormElement>('form')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(email?.value).toBe('luke@example.com');
    expect(password?.value).toBe('');
    expect(container.textContent).toContain('Email or password is incorrect');
  });
});
