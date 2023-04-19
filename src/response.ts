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

import { Response } from '@adobe/fetch';

export type ErrorWithResponse = Error & { response: Response };

export const makeResponse = (
  status: number,
  body: string | Record<string, unknown> = '',
  headers: Record<string, string> = {},
): Response => {
  if (body && typeof body === 'object') {
    // eslint-disable-next-line no-param-reassign
    body = JSON.stringify(body);
    // eslint-disable-next-line no-param-reassign
    headers['content-type'] = 'application/json';
  }
  return new Response(body as string, {
    status,
    headers: {
      'access-control-allow-origin': '*',
      ...headers,
    },
  });
};

export const makeErrorResponse = (
  status: number,
  xError: string,
  message?: string,
): Response => new Response(message ? JSON.stringify({ message }) : '', {
  status,
  headers: {
    'access-control-allow-origin': '*',
    'x-error': xError,
    ...(message ? { 'content-type': 'application/json' } : {}),
  },
});

export const throwableResponse = (
  statusCode: number,
  xError: string,
  message?: string,
): ErrorWithResponse => {
  const error = Error(xError) as ErrorWithResponse;
  error.response = makeErrorResponse(statusCode, xError, message);
  return error;
};

export const isErrorWithResponse = (obj: unknown): obj is ErrorWithResponse => {
  return (obj instanceof Error) && (obj as ErrorWithResponse).response instanceof Response;
};
