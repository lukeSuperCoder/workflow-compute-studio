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

import React from 'react';

import {
  getIsLogined,
  getIsSettled,
  getUserAuthInfos,
  getUserInfo,
  subscribeUserAuthInfos,
  useIsLogined,
  useIsSettled,
  useUserAuthInfo,
  useUserInfo,
  useUserLabel,
  type UserInfo,
} from './user-store-mock';
import { readSession } from './session';

export type { UserInfo };
export type LoginStatus = 'settling' | 'logined' | 'not_login';
export type ThemeType = 'dark' | 'light' | 'system';
export type BackButtonProps = React.ComponentProps<'button'>;
export type NavBtnProps = React.ComponentProps<'button'>;
export type OAuth2RedirectConfig = Record<string, unknown>;
export type OAuth2StateType = Record<string, unknown>;
export type UserConnectItem = Record<string, unknown>;

export const getLoginStatus = (): LoginStatus => 'logined';
export const useLoginStatus = (): LoginStatus => 'logined';
export const refreshUserInfo = () => Promise.resolve();
export const logoutOnly = () => Promise.resolve();
export const uploadAvatar = () => Promise.resolve({ web_uri: '' });
export const useCurrentTheme = (): ThemeType => 'light';

export const useSpace = (spaceId: string) => {
  const session = readSession();
  const resolvedSpaceId = spaceId || session?.spaceId || '999999';

  return {
    id: resolvedSpaceId,
    space_id: resolvedSpaceId,
    name: `Space ${resolvedSpaceId}`,
    description: '',
    icon_url: '',
    role_type: 1,
  };
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BackButton = (props: BackButtonProps) =>
  React.createElement('button', props, props.children);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const SideSheetMenu = () => null;

export {
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
};
