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

import type { Helix } from '@adobe/helix-universal';
import type { HTTPMethod } from './util';

export type Environment = Record<string, string>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface POSTData {
  // TODO
}

/**
 * Context
 */
export interface Context extends Helix.UniversalContext {
  env: Environment;
  data: POSTData | undefined;
  queryParams: URLSearchParams;
  log: Console;
  invocation: {
    id: string;
    deadline: number;
    transactionId: string;
    requestId: string;
    event: {
      version: string;
      resource: string;
      path: string;
      httpMethod: HTTPMethod;
      headers: Record<string, string>;
      multiValueHeaders: Record<string, string[]>,
      queryStringParameters: Record<string, string>;
      multiValueQueryStringParameters: Record<string, string[]>;
      requestContext: any;
      pathParameters: Record<string, string> | null;
      stageVariables: Record<string, string> | null;
      body: any | null;
      isBase64Encoded: boolean;
    }
  }
}
