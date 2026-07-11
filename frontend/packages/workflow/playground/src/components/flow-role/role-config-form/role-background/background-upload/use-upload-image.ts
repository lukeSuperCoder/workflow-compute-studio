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

import { I18n } from '@coze-arch/i18n';
import { uploadLocalFile } from '@coze-arch/bot-utils';
import { Toast } from '@coze-arch/bot-semi';

export const useUploadImage = ({
  onUploadError,
  onUploadSuccess,
}: {
  onUploadSuccess: (param: { url: string; uri: string }) => void;
  onUploadError: () => void;
}) => {
  const handleError = () => {
    onUploadError();
    Toast.error({
      content: I18n.t('Upload_failed'),
      showClose: false,
    });
  };

  const upload = async (file: File) => {
    let uri: string, url: string;
    try {
      const result = await uploadLocalFile({
        file,
      });
      uri = result.key;
      url = result.url;
    } catch {
      handleError();
      return;
    }
    if (!uri || !url) {
      handleError();
      return;
    }
    onUploadSuccess({
      uri,
      url,
    });
  };

  return {
    upload,
  };
};
