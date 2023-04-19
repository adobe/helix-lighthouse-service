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

import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import BASE_DESKTOP_CONFIG from 'lighthouse/core/config/lr-desktop-config.js';
import BASE_MOBILE_CONFIG from 'lighthouse/core/config/lr-mobile-config.js';
import chromium from '@sparticuz/chromium';

import type { Flags, Config as LHConfig, Result as LHResult } from 'lighthouse';
import type { Browser } from 'puppeteer';
import { throwableResponse } from './response.js';
import type { Config, Context, IncludeStrings } from './types';

export const CATEGORIES_WO_PWA = ['accessibility', 'best-practices', 'performance', 'seo'];

const FLAGS: Flags = {
  disableFullPageScreenshot: true,
};

const DESKTOP_CONFIG: LHConfig = {
  ...(BASE_DESKTOP_CONFIG as LHConfig),
};

const MOBILE_CONFIG: LHConfig = {
  ...(BASE_MOBILE_CONFIG as LHConfig),
  settings: {
    ...(BASE_MOBILE_CONFIG as LHConfig).settings,
    maxWaitForFcp: 15 * 1000,
    maxWaitForLoad: 35 * 1000,
    throttlingMethod: 'simulate',
    throttling: {
      requestLatencyMs: 150,
      uploadThroughputKbps: 750,
      downloadThroughputKbps: 1600,
      cpuSlowdownMultiplier: 1,
    },
  },
};

function filterResultKey(
  key: 'categories' | 'audits',
  result: Partial<LHResult>,
  include: IncludeStrings,
): Partial<LHResult> {
  if (include === 'all') {
    return result;
  }

  if (!include.length) {
    // eslint-disable-next-line no-param-reassign
    result[key] = {};
    return result;
  }

  // eslint-disable-next-line no-param-reassign
  result[key] = Object.fromEntries(Object.entries(result[key]).filter(([k]) => {
    return include.includes(k);
  }));
  if (!Object.keys(result[key]).length) {
    // eslint-disable-next-line no-param-reassign
    delete result[key];
  }
  return result;
}

function filterAudits(
  presult: Partial<LHResult>,
  audits: IncludeStrings,
): Partial<LHResult> {
  const result = filterResultKey('audits', presult, audits);
  if (audits === 'all') {
    return result;
  }

  result.categories = Object.entries(result.categories).reduce((prev, [k, v]) => {
    // eslint-disable-next-line no-param-reassign
    prev[k] = {
      ...v,
      auditRefs: !audits.length ? undefined : v.auditRefs.filter((ref) => audits.includes(ref.id)),
    };
    return prev;
  }, {});

  return result;
}

function filterResult(presult: LHResult, config: Config): Partial<LHResult> {
  const { audits, categories, timing } = config;
  let result = presult as Partial<LHResult>;
  delete result.i18n;
  delete result.categoryGroups;

  result = filterResultKey('categories', result, categories);
  result = filterAudits(result, audits);
  if (!timing) {
    delete result.timing;
  }

  return result;
}

export default async function runLighthouse(config: Config, ctx: Context) {
  const { log } = ctx;
  const {
    url,
    strategy = 'mobile',
    cookies,
    categories,
  } = config;

  log.debug('[Lighthouse] running on url: ', url.toString());

  let browser: Browser;
  if (process.env.NODE_ENV === 'testing') {
    browser = await puppeteer.launch({
      headless: 'new',
      defaultViewport: chromium.defaultViewport,
      args: chromium.args,
    });
  } else {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      args: chromium.args,
    });
  }

  const page = await browser.newPage();

  if (cookies && cookies.length) {
    await page.setCookie(...cookies);
  }

  const lhConfig = strategy === 'desktop' ? DESKTOP_CONFIG : MOBILE_CONFIG;

  // exclude pwa from the test entirely, if possible
  if (categories !== 'all' && !categories.includes('pwa')) {
    lhConfig.settings.onlyCategories = CATEGORIES_WO_PWA;
  }

  const resp = await lighthouse(
    url.toString(),
    FLAGS,
    lhConfig,
    page,
  );
  if (!resp) {
    throw throwableResponse(500, 'failed to run lighthouse');
  }

  const { lhr: result } = resp;
  if (result.runWarnings && cookies && cookies.find((c) => c.name === 'hlx-auth-token')) {
    const redirectedToLogin = result.runWarnings.find((warning) => warning.includes('was redirected to https://login.microsoftonline.com'));
    if (redirectedToLogin) {
      throw throwableResponse(401, 'authorization error', redirectedToLogin);
    }
  }

  // don't wait for browser close
  // it should be cleaned up anyway, and waiting causes a timeout often
  // await browser.close();

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  page.close();

  if (result.runtimeError) {
    log.info('[Lighthouse] runtime error: ', result.runtimeError);
    const { code, message } = result.runtimeError;
    throw throwableResponse(500, `error from lighthouse: ${code}`, message);
  }

  return filterResult(result, config);
}
