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

import wrap from '@adobe/helix-shared-wrap';
import bodyData from '@adobe/helix-shared-body-data';
import { helixStatus } from '@adobe/helix-status';

import type {
  wrap as WrapT,
  WrapFunction,
} from '@adobe/helix-shared-wrap';
import {
  makeResponse,
  makeErrorResponse,
  ErrorWithResponse,
  isErrorWithResponse,
} from './response.js';
import resolveConfig from './config.js';
import runLighthouse from './lighthouse.js';
import timeout from './timeout.js';

import type { Context, Request } from './types';

const TIMEOUT = 30000;

const setupContext = (_request: Request, pctx: Partial<Context>) => {
  const ctx = pctx as Context;

  if (!ctx.queryParams) {
    if (ctx.data && Object.entries(ctx.data).length) {
      ctx.queryParams = new URLSearchParams(ctx.data as Record<string, string>);
    } else if (ctx.invocation?.event?.queryStringParameters) {
      ctx.queryParams = new URLSearchParams(ctx.invocation.event.queryStringParameters);
    } else {
      ctx.queryParams = new URLSearchParams();
    }
  }
  return ctx;
};

const run = async (request: Request, ctx: Context) => {
  const { log } = ctx;
  // eslint-disable-next-line no-param-reassign
  ctx = setupContext(request, ctx);

  if (request.method === 'OPTIONS') {
    return makeResponse(204, undefined, {
      'access-control-max-age': '86400',
      'access-control-allow-methods': 'GET, POST',
      'access-control-allow-headers': 'x-set-cookie',
    });
  }

  try {
    const config = resolveConfig(request, ctx);
    const lighthouseResult = await timeout(() => runLighthouse(config, ctx), TIMEOUT);
    return makeResponse(200, { lighthouseResult });
  } catch (e) {
    const err = e as Error | ErrorWithResponse;
    if (err.message === 'timeout') {
      return makeErrorResponse(504, 'timeout');
    }

    if (isErrorWithResponse(err)) {
      return err.response;
    }

    log.error('runtime error: ', err);
    return makeErrorResponse(500, err.message);
  }
};

/* eslint-disable */
export default (wrap as unknown as typeof WrapT)(run)
  .with(bodyData as unknown as WrapFunction)
  .with(helixStatus as WrapFunction);
