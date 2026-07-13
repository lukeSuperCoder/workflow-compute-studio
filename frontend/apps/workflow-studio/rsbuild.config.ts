/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import path from 'path';

import { defineConfig } from '@coze-arch/rsbuild-config';
import { GLOBAL_ENVS } from '@coze-arch/bot-env';

const API_PROXY_TARGET = `http://localhost:${
  process.env.WORKFLOW_SERVER_PORT || process.env.WEB_SERVER_PORT || 8889
}/`;
const WEB_DEV_PORT = Number(process.env.WEB_DEV_PORT || 5174);

export default defineConfig({
  dev: {
    client: {
      port: WEB_DEV_PORT,
      host: '127.0.0.1',
      protocol: 'ws',
    },
  },
  server: {
    strictPort: true,
    port: WEB_DEV_PORT,
    proxy: [
      {
        context: ['/api', '/assets', '/healthz'],
        target: API_PROXY_TARGET,
        secure: false,
        changeOrigin: true,
      },
    ],
  },
  html: {
    title: '算子工作流',
    template: './index.html',
    crossorigin: 'anonymous',
  },
  tools: {
    postcss: (_opts, { addPlugins }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      addPlugins([require('tailwindcss')('./tailwind.config.ts')]);
    },
    rspack(config, { addRules, mergeConfig }) {
      addRules([
        {
          test: /\.(css|less|jsx|tsx|ts|js)/,
          exclude: [
            /node_modules/,
            new RegExp('packages/arch/i18n'),
            new RegExp('apps/workflow-studio/src/styles.css'),
          ],
          use: '@coze-arch/import-watch-loader',
        },
      ]);

      return mergeConfig(config, {
        module: {
          parser: {
            javascript: {
              exportsPresence: false,
            },
          },
        },
        resolve: {
          fallback: {
            path: require.resolve('path-browserify'),
          },
        },
        watchOptions: {
          poll: true,
        },
        ignoreWarnings: [
          /Critical dependency: the request of a dependency is an expression/,
          () => true,
        ],
      });
    },
  },
  source: {
    define: {
      'process.env.IS_REACT18': JSON.stringify(true),
      'process.env.ARCOSITE_SDK_REGION': JSON.stringify(
        GLOBAL_ENVS.IS_OVERSEA ? 'VA' : 'CN',
      ),
      'process.env.ARCOSITE_SDK_SCOPE': JSON.stringify(
        GLOBAL_ENVS.IS_RELEASE_VERSION ? 'PUBLIC' : 'INSIDE',
      ),
      'process.env.TARO_PLATFORM': JSON.stringify('web'),
      'process.env.SUPPORT_TARO_POLYFILL': JSON.stringify('disabled'),
      'process.env.RUNTIME_ENTRY': JSON.stringify('@coze-dev/runtime'),
      'process.env.TARO_ENV': JSON.stringify('h5'),
      ENABLE_COVERAGE: JSON.stringify(false),
    },
    include: [
      path.resolve(__dirname, '../../packages'),
      path.resolve(__dirname, '../../infra/flags-devtool'),
      /\/node_modules\/(marked|@dagrejs|@tanstack)\//,
    ],
    alias: {
      '@coze-arch/bot-api': path.resolve(
        __dirname,
        '../../packages/arch/bot-api/src/index.ts',
      ),
      '@coze-studio/user-store': path.resolve(
        __dirname,
        './src/user-store-mock.ts',
      ),
      '@coze-arch/foundation-sdk': path.resolve(
        __dirname,
        './src/foundation-sdk-mock.ts',
      ),
      'react-router-dom': require.resolve('react-router-dom'),
    },
    decorators: {
      version: 'legacy',
    },
  },
  performance: {
    chunkSplit: {
      strategy: 'split-by-size',
      minSize: 3_000_000,
      maxSize: 6_000_000,
    },
  },
});
