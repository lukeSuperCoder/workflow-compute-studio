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

import { addGlobalRequestInterceptor } from '@coze-arch/bot-api';

import { readSession } from './session';

const SPACE_LIST_PATH = '/api/playground_api/space/list';

let installed = false;

export function installWorkflowApiMocks() {
  if (installed) {
    return;
  }

  addGlobalRequestInterceptor(config => {
    const url = String(config.url ?? '');
    if (url !== SPACE_LIST_PATH) {
      return config;
    }

    config.adapter = adapterConfig => {
      const session = readSession();
      const spaceId = session?.spaceId ?? '999999';
      const spaceName = `空间 ${spaceId}`;
      const space = {
        id: spaceId,
        name: spaceName,
        description: '算子工作流空间',
        icon_url: '',
        space_type: 1,
      };

      return Promise.resolve({
        data: {
          code: 0,
          msg: '',
          data: {
            bot_space_list: [space],
            recently_used_space_list: [space],
            has_personal_space: true,
            team_space_num: 0,
            max_team_space_num: 1,
            total: 1,
            has_more: false,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: adapterConfig,
        request: {},
      });
    };

    return config;
  });

  installed = true;
}
