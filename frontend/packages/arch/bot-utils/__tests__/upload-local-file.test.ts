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

import { uploadLocalFile } from '../src/upload-local-file';

describe('upload-local-file', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  test('should upload file with multipart form data', async () => {
    const getProgress = vi.fn();
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            key: 'uploads/10001/2026-07/file.txt',
            url: '/api/files/uploads/10001/2026-07/file.txt',
            name: 'file.txt',
            size: 5,
            content_type: 'text/plain',
          }),
          { status: 200 },
        ),
      ),
    ) as typeof fetch;

    const result = await uploadLocalFile({
      file: new File(['hello'], 'file.txt', { type: 'text/plain' }),
      getProgress,
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/files/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
        credentials: 'include',
      }),
    );
    expect(result.key).toBe('uploads/10001/2026-07/file.txt');
    expect(getProgress).toHaveBeenCalledWith(100);
  });

  test('should reject failed response status', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response('forbidden', { status: 403 })),
    ) as typeof fetch;

    await expect(
      uploadLocalFile({ file: new File([], 'file.txt') }),
    ).rejects.toThrow('upload failed with status 403');
  });

  test('should reject invalid response payload', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ key: '' }), { status: 200 })),
    ) as typeof fetch;

    await expect(
      uploadLocalFile({ file: new File([], 'file.txt') }),
    ).rejects.toThrow('invalid upload response');
  });
});
