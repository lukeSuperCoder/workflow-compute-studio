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

import { readSession } from './session';

export interface UserInfo {
  user_id: number;
  user_id_str: string;
  name: string;
  screen_name: string;
  avatar_url: string;
  locale: string;
  app_user_info: {
    user_unique_name: string;
  };
}

export type UserAuthInfo = Record<string, unknown>;
export type UserLabel = Record<string, unknown>;

function getCurrentUserInfo(): UserInfo {
  const session = readSession();
  const userId = session?.userId ?? '10001';
  const userName = session?.userName ?? '工作流开发者';

  return {
    user_id: Number(userId),
    user_id_str: userId,
    name: userName,
    screen_name: userName,
    avatar_url: '',
    locale: localStorage.getItem('i18next') ?? navigator.language ?? 'zh-CN',
    app_user_info: {
      user_unique_name: userName,
    },
  };
}

export const getIsSettled = () => true;
export const getIsLogined = () => true;
export const getUserInfo = () => getCurrentUserInfo();
export const getUserAuthInfos = () => [] as UserAuthInfo[];
export const useIsSettled = () => true;
export const useIsLogined = () => true;
export const useUserInfo = () => getCurrentUserInfo();
export const useUserAuthInfo = () => [] as UserAuthInfo[];
export const useUserLabel = () => undefined as UserLabel | undefined;
export const subscribeUserAuthInfos = () => () => undefined;

export const userStoreService = {
  getIsSettled,
  getIsLogined,
  getUserInfo,
  getUserAuthInfos,
  useIsSettled,
  useIsLogined,
  useUserInfo,
  useUserAuthInfo,
  useUserLabel,
  subscribeUserAuthInfos,
} as const;
