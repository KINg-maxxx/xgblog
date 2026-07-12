import assert from 'node:assert/strict';
import test from 'node:test';

import * as analytics from '../src/analytics.js';

const CONSENT_KEY = 'wxg_analytics_consent';
const GA_DISABLE_KEY = `ga-disable-${analytics.GOOGLE_ANALYTICS_ID}`;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function harness(hostname, choice) {
  const scripts = [];
  const storageRef = memoryStorage(choice ? { [CONSENT_KEY]: choice } : {});
  const documentRef = {
    createElement(tagName) {
      return { tagName };
    },
    head: {
      appendChild(element) {
        scripts.push(element);
      },
    },
  };
  const windowRef = {
    location: { hostname, protocol: 'https:' },
    localStorage: storageRef,
  };
  return { documentRef, scripts, storageRef, windowRef };
}

test('GA creates no loader, data layer, or config before persisted analytics consent', () => {
  const probe = harness('blog.periopact.cn');

  const initialized = analytics.initializeAnalytics(probe);

  assert.equal(initialized, false);
  assert.equal(probe.scripts.length, 0);
  assert.equal(probe.windowRef.dataLayer, undefined);
  assert.equal(probe.windowRef.gtag, undefined);
});

test('GA runs only on the two exact production hosts', () => {
  for (const hostname of ['xgblog.pages.dev', 'blog.periopact.cn']) {
    const probe = harness(hostname, 'granted');
    assert.equal(analytics.initializeAnalytics(probe), true, hostname);
    assert.equal(probe.scripts.length, 1, hostname);
  }

  for (const hostname of [
    'preview.xgblog.pages.dev',
    'feat-123.xgblog.pages.dev',
    'annotate.periopact.cn',
    'localhost',
    '127.0.0.1',
  ]) {
    const probe = harness(hostname, 'granted');
    assert.equal(analytics.initializeAnalytics(probe), false, hostname);
    assert.equal(probe.scripts.length, 0, hostname);
  }
});

test('allow analytics persists consent and loads the GA script and config exactly once', () => {
  assert.equal(typeof analytics.setAnalyticsConsent, 'function');
  const probe = harness('blog.periopact.cn');

  assert.equal(analytics.initializeAnalytics(probe), false);
  assert.equal(analytics.setAnalyticsConsent('granted', probe), true);
  analytics.setAnalyticsConsent('granted', probe);

  assert.equal(probe.storageRef.getItem(CONSENT_KEY), 'granted');
  assert.equal(probe.scripts.length, 1);
  assert.equal(
    probe.windowRef.dataLayer.filter(entry => Array.from(entry)[0] === 'config').length,
    1,
  );
});

test('persisted denial sets the standard GA disable flag and never loads GA', () => {
  const probe = harness('blog.periopact.cn', 'denied');

  assert.equal(analytics.initializeAnalytics(probe), false);

  assert.equal(probe.windowRef[GA_DISABLE_KEY], true);
  assert.equal(probe.scripts.length, 0);
  assert.equal(probe.windowRef.dataLayer, undefined);
  assert.equal(probe.windowRef.gtag, undefined);
});

test('grant clears the standard GA disable flag before initialization', () => {
  const probe = harness('blog.periopact.cn');
  probe.windowRef[GA_DISABLE_KEY] = true;
  let disabledAtScriptLoad;
  const appendChild = probe.documentRef.head.appendChild;
  probe.documentRef.head.appendChild = element => {
    disabledAtScriptLoad = probe.windowRef[GA_DISABLE_KEY];
    appendChild(element);
  };

  assert.equal(analytics.setAnalyticsConsent('granted', probe), true);

  assert.equal(disabledAtScriptLoad, false);
  assert.equal(probe.windowRef[GA_DISABLE_KEY], false);
  assert.equal(probe.scripts.length, 1);
});

test('revoking granted consent disables GA before dispatching its consent update', () => {
  const probe = harness('blog.periopact.cn', 'granted');
  assert.equal(analytics.initializeAnalytics(probe), true);
  const updates = [];
  probe.windowRef.gtag = (...args) => {
    updates.push({ args, disabled: probe.windowRef[GA_DISABLE_KEY] });
  };

  assert.equal(analytics.setAnalyticsConsent('denied', probe), true);

  assert.equal(probe.windowRef[GA_DISABLE_KEY], true);
  assert.deepEqual(updates, [{
    args: ['consent', 'update', { analytics_storage: 'denied' }],
    disabled: true,
  }]);
  assert.equal(probe.scripts.length, 1);
});

test('necessary-only consent persists without loading GA, including when storage is unavailable', () => {
  assert.equal(typeof analytics.setAnalyticsConsent, 'function');
  const probe = harness('xgblog.pages.dev');

  assert.equal(analytics.setAnalyticsConsent('denied', probe), true);
  assert.equal(probe.storageRef.getItem(CONSENT_KEY), 'denied');
  assert.equal(probe.scripts.length, 0);

  const unavailable = harness('xgblog.pages.dev');
  unavailable.storageRef.setItem = () => {
    throw new Error('storage unavailable');
  };
  assert.equal(analytics.setAnalyticsConsent('granted', unavailable), false);
  assert.equal(unavailable.scripts.length, 0);
});
