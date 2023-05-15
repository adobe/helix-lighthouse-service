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

import puppeteer, { Page } from 'puppeteer';
import lighthouse from 'lighthouse';
import BASE_DESKTOP_CONFIG from 'lighthouse/core/config/lr-desktop-config.js';
import BASE_MOBILE_CONFIG from 'lighthouse/core/config/lr-mobile-config.js';
import chromium from '@sparticuz/chromium';

import type { Flags, Config as LHConfig, Result as LHResult } from 'lighthouse';
import type { Browser } from 'puppeteer';
import { throwableResponse } from './response.js';
import type { Config, Context, IncludeStrings } from './types';

export const CATEGORIES_WO_PWA = ['accessibility', 'best-practices', 'performance', 'seo'];

const CHROMIUM_ARGS = [
  '--allow-pre-commit-input',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--enable-automation',
  '--enable-blink-features=IdleDetection',
  '--export-tagged-pdf',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--no-first-run',
  '--password-store=basic',
  '--use-mock-keychain',
  '--disable-domain-reliability',
  '--disable-print-preview',
  '--disable-speech-api',
  '--disk-cache-size=33554432',
  '--mute-audio',
  '--no-default-browser-check',
  '--no-pings',
  '--single-process',
  '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints,AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
  '--enable-features=NetworkServiceInProcess2,SharedArrayBuffer',
  '--hide-scrollbars',
  '--ignore-gpu-blocklist',
  '--in-process-gpu',
  '--window-size=1920,1080',
  '--allow-running-insecure-content',
  '--disable-setuid-sandbox',
  '--disable-site-isolation-trials',
  '--disable-web-security',
  '--no-sandbox',
  '--no-zygote',
  "--headless='new'",
  // MODIFIED
  '--use-gl=swiftshader',
  '--use-angle=gl',
  // ADDED
  '--disable-gpu',
];

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
    networkQuietThresholdMs: 1000,
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
    audits,
  } = config;

  log.debug('[Lighthouse] running on url: ', url.toString());

  let browser: Browser;
  let page: Page;

  try {
    if (process.env.NODE_ENV === 'testing') {
      browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: chromium.defaultViewport,
        args: CHROMIUM_ARGS,
      });
    } else {
      const executablePath = await chromium.executablePath();
      browser = await puppeteer.launch({
        headless: chromium.headless,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        args: CHROMIUM_ARGS,
      });
    }

    log.debug('[Lighthouse] launched browser...');

    page = await browser.newPage();

    log.debug('[Lighthouse] created page...');

    if (cookies && cookies.length) {
      await page.setCookie(...cookies);
    }

    log.debug('[Lighthouse] set cookies...');

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
    log.debug('[Lighthouse] ran lighthouse...');

    if (!resp) {
      log.error('[Lighthouse] error: did not get response');
      throw throwableResponse(500, 'failed to run lighthouse');
    }

    const { lhr: result } = resp;
    if (result.runWarnings && cookies && cookies.find((c) => c.name === 'hlx-auth-token')) {
      const redirectedToLogin = result.runWarnings.find((warning) => warning.includes('was redirected to https://login.microsoftonline.com'));
      if (redirectedToLogin) {
        throw throwableResponse(401, 'authorization error', 'test URL was redirected to login');
      }
    }

    if ((audits.includes('all') || audits.includes('speed-index')) && result.audits['speed-index']?.score === null) {
      const msg = result.audits['speed-index'].errorMessage || 'failed to get performance score';
      log.error('[Lighthouse] audit error: ', msg);
      throw throwableResponse(502, msg);
    }

    if (result.runtimeError) {
      log.info('[Lighthouse] runtime error: ', result.runtimeError);
      const { code, message } = result.runtimeError;
      throw throwableResponse(502, `error from lighthouse: ${code}`, message);
    }

    return filterResult(result, config);
  } finally {
    log.info('[Lighthouse] cleaning up...');
    await page.close();
    await browser.close();
  }
}
