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

import { throwableResponse } from './response';
import { CATEGORIES_WO_PWA } from './lighthouse';

import type {
  Config,
  Context,
  CookieConfig,
  IncludeStrings,
  Request,
} from './types';

const DEFAULT_AUDITS = [
  'speed-index',
  'first-contentful-paint',
  'first-meaningful-paint',
  'largest-contentful-paint',
  'interactive',
  'total-blocking-time',
  'cumulative-layout-shift',
];

const parseMultiValueHeader = (all: string): Record<string, string> => Object.fromEntries(all.split(';').map((one) => one.trim().split('='))) as Record<string, string>;

const parseCookies = (
  url: URL,
  headerVal: string,
  ctx: Context,
): CookieConfig[] => {
  const { log } = ctx;
  const cookies = parseMultiValueHeader(headerVal);
  const spl = url.hostname.split('.');
  const domain = spl.slice(Math.max(spl.length - 3, 0)).join('.');
  // TODO: make these configurable from the header
  const cookieArr = Object.entries(cookies).map(([name, value]) => ({
    domain,
    name,
    value,
    sameSite: 'None' as const,
    path: '/',
    httpOnly: true,
    secure: true,
    expires: Math.ceil(Date.now() / 1000 + 30),
  }));
  log.debug('[config] set cookies: ', cookieArr.map((c) => c.name));
  return cookieArr;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function resolvePOSTConfig(request: Request, ctx: Context): Config {
  throw Error('not implemented');
}

function assertValidStrategy(strategy?: string | null): asserts strategy is Config['strategy'] {
  if (strategy && !['mobile', 'desktop'].includes(strategy)) {
    throw throwableResponse(400, 'invalid strategy');
  }
}

function parseIncludeStrings(str: string, fallback: IncludeStrings = []): IncludeStrings {
  if (!str) {
    return fallback;
  }
  const spl = str.split(',').map((s) => s.trim());
  if (spl.includes('all')) {
    return 'all';
  }
  return spl;
}

export default function resolveConfig(request: Request, ctx: Context): Config {
  if (request.method === 'POST') {
    return resolvePOSTConfig(request, ctx);
  }

  const strategy = ctx.queryParams.get('strategy');
  assertValidStrategy(strategy);

  const urlString = ctx.queryParams.get('url');
  if (!urlString) {
    throw throwableResponse(400, 'missing url parameter');
  }

  let url: URL;
  try {
    url = new URL(decodeURIComponent(urlString));
  } catch {
    throw throwableResponse(400, 'invalid url parameter');
  }

  const audits = parseIncludeStrings(ctx.queryParams.get('audits'), DEFAULT_AUDITS);
  const categories = parseIncludeStrings(ctx.queryParams.get('categories'), CATEGORIES_WO_PWA);
  const timing = ['true', true].includes(ctx.queryParams.get('timing'));

  const config: Config = {
    url,
    strategy,
    cookies: [],
    audits,
    categories,
    timing,
  };
  if (request.headers.has('x-set-cookie')) {
    config.cookies = parseCookies(url, request.headers.get('x-set-cookie'), ctx);
  }

  return config;
}
