/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-disable no-console */

import { DevelopmentServer } from '@adobe/helix-deploy';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

/* eslint-disable */
import handler from '../../dist/main/handler.js';
/* eslint-enable */

// eslint-disable-next-line no-underscore-dangle
global.__rootdir = resolve(fileURLToPath(import.meta.url), '..', '..', '..');

async function run() {
  const devServer = await new DevelopmentServer((req, ctx) => {
    if (req.url) {
      const params = new URL(req.url).searchParams;
      if (params.keys().length) {
        ctx.queryParams = params;
      }
    }
    return handler(req, ctx);
  })
    .withXFH('localhost:{port}')
    .init();
  await devServer.start();
}

process.on('unhandledRejection', (error) => {
  console.error('*** unhandledRejection ***', error);
});

run().catch(console.error);
