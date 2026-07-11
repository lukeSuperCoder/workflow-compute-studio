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

export interface LocalUploadFileResult {
  key: string;
  url: string;
  name: string;
  size: number;
  content_type: string;
}

export async function uploadLocalFile({
  file,
  getProgress,
}: {
  file: File;
  getProgress?: (progress: number) => void;
}): Promise<LocalUploadFileResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`upload failed with status ${response.status}`);
  }

  const result = (await response.json()) as LocalUploadFileResult;
  if (!result.key || !result.url) {
    throw new Error('invalid upload response');
  }

  getProgress?.(100);
  return result;
}
