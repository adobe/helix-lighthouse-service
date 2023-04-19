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

/* eslint-disable no-underscore-dangle, import/no-extraneous-dependencies */

import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import { config as configEnv } from 'dotenv';
// import { copy as copyPlugin } from 'esbuild-plugin-copy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

configEnv();
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const args = process.argv.slice(1);
const dev = ['development', 'testing'].includes(process.env.NODE_ENV);
const watch = !!args.find((arg) => arg === '-w' || arg === '--watch');
const devServer = !!args.find((arg) => arg === '-ds' || arg === '--dev-server');
const minify = !dev;

try {
  /** @type {import('esbuild').BuildOptions} */
  const opts = {
    bundle: true,
    sourcemap: dev,
    minify,
    format: 'esm',
    treeShaking: true,
    platform: 'node',
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    tsconfig: path.resolve(__dirname, './tsconfig.json'),
    target: 'esnext',
    external: [
      '@sparticuz/chromium',
      'lighthouse',
      './main.js',
      'aws-sdk',
    ].filter((b) => Boolean(b)),
    entryPoints: [path.resolve(__dirname, 'src/index.ts')],

    // this dir depth matters, since helix-fetch requires package.json from 2 dirs up
    // see: https://github.com/adobe/fetch/blob/c9f99dd3a4791c02d8091ac27719927eccb3158c/src/core/request.js#L29
    outdir: path.resolve(__dirname, 'dist/main'),

    // workaround for ESM imports of node builtins being transpiled to dynamic requires
    // see: https://github.com/evanw/esbuild/issues/1921
    banner: {
      js: `
      ${minify ? 'import path from \'path\';' : ''}
      import { fileURLToPath } from 'url';
      import { createRequire as topLevelCreateRequire } from 'module';
      const require = topLevelCreateRequire(import.meta.url);
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      `,
    },
  };

  if (devServer) {
    // skip the universal wrapper, it's applied by the dev server
    opts.entryPoints.push(path.resolve(__dirname, 'src/handler.ts'));
  }

  if (watch) {
    const context = await esbuild.context(opts);
    await context.watch();
  } else {
    await esbuild.build(opts);
  }
} catch (e) {
  console.error('build error: ', e);
  process.exitCode = 1;
}
