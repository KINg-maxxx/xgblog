import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const workbench = readFileSync(new URL('../public/tools/annotation-workbench.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const siteData = readFileSync(new URL('../src/data/site.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function extractScript(id) {
  const match = workbench.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`));
  assert.ok(match, `script #${id} should exist`);
  return match[1];
}

function extractFunction(name) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = pattern.exec(workbench);
  assert.ok(match, `function ${name} should exist`);
  const start = match.index;
  const bodyStart = workbench.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < workbench.length; index += 1) {
    if (workbench[index] === '{') depth += 1;
    if (workbench[index] === '}') {
      depth -= 1;
      if (depth === 0) return workbench.slice(start, index + 1);
    }
  }
  throw new Error(`function ${name} is not balanced`);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createGate() {
  let generation = 0;
  let locked = true;
  let lockCalls = 0;
  let unlockCalls = 0;
  return {
    api: Object.freeze({
      capture: () => generation,
      allows: token => !locked && (token === undefined || token === generation),
      lock: () => {
        generation += 1;
        locked = true;
        lockCalls += 1;
      },
      unlock: () => {
        locked = false;
        unlockCalls += 1;
      },
    }),
    generation: () => generation,
    isLocked: () => locked,
    lockCalls: () => lockCalls,
    unlockCalls: () => unlockCalls,
  };
}

function createHeartbeatHarness(initialFetch) {
  const elements = new Map();
  const listeners = new Map();
  const windowListeners = new Map();
  const timeouts = new Map();
  const intervals = new Map();
  const gate = createGate();
  let fetchImpl = initialFetch;
  let timerId = 0;

  class FakeElement {
    constructor() {
      this.attributes = new Set();
      this.dataset = {};
      this.children = [];
      this.parentElement = null;
      this.style = {};
      this.queries = new Map();
    }

    set id(value) {
      this._id = value;
      if (value) elements.set(value, this);
    }

    get id() {
      return this._id || '';
    }

    set innerHTML(value) {
      this._innerHTML = value;
    }

    get innerHTML() {
      return this._innerHTML || '';
    }

    addEventListener(type, listener) {
      this.queries.set(`listener:${type}`, listener);
    }

    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      if (child.id) elements.set(child.id, child);
      return child;
    }

    focus() {}

    hasAttribute(name) {
      return this.attributes.has(name);
    }

    querySelector(selector) {
      if (!this.queries.has(selector)) this.queries.set(selector, new FakeElement());
      return this.queries.get(selector);
    }

    remove() {
      elements.delete(this.id);
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter(child => child !== this);
      }
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }

    setAttribute(name) {
      this.attributes.add(name);
    }
  }

  const body = new FakeElement();
  const workbenchSurface = new FakeElement();
  workbenchSurface.id = 'workbenchSurface';
  body.appendChild(workbenchSurface);
  const document = {
    body,
    fullscreenElement: null,
    readyState: 'loading',
    visibilityState: 'visible',
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    createElement() {
      return new FakeElement();
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
  };
  const window = {
    __workbenchAuthGate: gate.api,
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
  };
  const context = {
    AbortController,
    DOMException,
    MutationObserver: class {
      disconnect() {}
      observe() {}
    },
    Promise,
    Response,
    clearInterval(id) {
      intervals.delete(id);
    },
    clearTimeout(id) {
      timeouts.delete(id);
    },
    console,
    document,
    fetch(...args) {
      return fetchImpl(...args);
    },
    setInterval(callback, ms) {
      const id = ++timerId;
      intervals.set(id, { callback, ms });
      return id;
    },
    setTimeout(callback, ms) {
      const id = ++timerId;
      timeouts.set(id, { callback, ms });
      return id;
    },
    window,
  };
  vm.runInNewContext(extractScript('sso-workbench-heartbeat'), context);

  return {
    api: () => window.__ssoWorkbenchAuth,
    gate,
    heartbeatMs() {
      const entry = intervals.values().next().value;
      assert.ok(entry, 'a heartbeat interval should be scheduled');
      return entry.ms;
    },
    runNextTimeout() {
      const entry = timeouts.entries().next().value;
      assert.ok(entry, 'a timeout should be scheduled');
      const [id, timer] = entry;
      timeouts.delete(id);
      timer.callback();
      return timer.ms;
    },
    setFetch(nextFetch) {
      fetchImpl = nextFetch;
    },
    showPage(persisted) {
      const listener = windowListeners.get('pageshow');
      assert.ok(listener, 'the heartbeat should listen for pageshow');
      listener({ persisted });
    },
    hidePage() {
      const listener = windowListeners.get('pagehide');
      assert.ok(listener, 'the heartbeat should listen for pagehide');
      listener();
    },
    freeze() {
      const listener = listeners.get('freeze');
      assert.ok(listener, 'the heartbeat should listen for freeze');
      listener();
    },
    hidden() {
      document.visibilityState = 'hidden';
      const listener = listeners.get('visibilitychange');
      assert.ok(listener, 'the heartbeat should listen for visibility changes');
      listener();
    },
    start() {
      const listener = listeners.get('DOMContentLoaded');
      assert.ok(listener, 'the heartbeat should wait for DOMContentLoaded');
      listener();
    },
    timeouts,
    visible() {
      document.visibilityState = 'visible';
      const listener = listeners.get('visibilitychange');
      assert.ok(listener, 'the heartbeat should listen for visibility changes');
      listener();
    },
  };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('a hanging session probe times out, locks closed, and cannot occupy the next probe', async () => {
  let calls = 0;
  let firstSignal;
  const harness = createHeartbeatHarness((_url, init) => {
    calls += 1;
    firstSignal = init.signal;
    return new Promise(() => {});
  });
  const api = harness.api();
  assert.ok(api, 'heartbeat should expose its deterministic controller');

  const firstProbe = api.checkSession();
  const timeoutMs = harness.runNextTimeout();
  assert.ok(timeoutMs < 60_000, 'probe timeout must be shorter than the heartbeat cadence');
  await firstProbe;

  assert.equal(firstSignal.aborted, true);
  assert.equal(harness.gate.isLocked(), true);
  harness.setFetch(async () => {
    calls += 1;
    return jsonResponse(200, { authenticated: true, permission: 'annotate.access', ssoEnabled: true });
  });

  await api.checkSession();

  assert.equal(calls, 2);
  assert.equal(harness.gate.isLocked(), false);
});

test('heartbeat cadence includes the network timeout within a 60-second lock deadline', async () => {
  const harness = createHeartbeatHarness(() => new Promise(() => {}));

  harness.start();
  const heartbeatMs = harness.heartbeatMs();
  const timeoutMs = harness.runNextTimeout();
  await Promise.resolve();

  assert.ok(
    heartbeatMs + timeoutMs <= 60_000,
    `heartbeat ${heartbeatMs}ms plus timeout ${timeoutMs}ms exceeds the lock deadline`,
  );
});

test('visibility return locks synchronously before the resumed session probe settles', async () => {
  const resumed = deferred();
  let calls = 0;
  const harness = createHeartbeatHarness(() => {
    calls += 1;
    if (calls === 1) {
      return Promise.resolve(jsonResponse(200, {
        authenticated: true,
        permission: 'annotate.access',
        ssoEnabled: true,
      }));
    }
    return resumed.promise;
  });

  harness.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(harness.gate.isLocked(), false);
  const unlockedGeneration = harness.gate.generation();

  harness.visible();

  assert.equal(harness.gate.isLocked(), true);
  assert.equal(harness.gate.api.allows(unlockedGeneration), false);
  resumed.resolve(jsonResponse(200, {
    authenticated: true,
    permission: 'annotate.access',
    ssoEnabled: true,
  }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(harness.gate.isLocked(), false);
});

test('browser lifecycle loss locks synchronously and a stale probe cannot unlock in the background', async () => {
  const stale = deferred();
  const harness = createHeartbeatHarness(async () => jsonResponse(200, {
    authenticated: true,
    permission: 'annotate.access',
    ssoEnabled: true,
  }));

  harness.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(harness.gate.isLocked(), false);

  harness.setFetch(() => stale.promise);
  const staleProbe = harness.api().checkSession();
  harness.hidden();
  assert.equal(harness.gate.isLocked(), true);

  stale.resolve(jsonResponse(200, {
    authenticated: true,
    permission: 'annotate.access',
    ssoEnabled: true,
  }));
  await staleProbe;
  assert.equal(harness.gate.isLocked(), true);

  harness.gate.api.unlock();
  harness.hidePage();
  assert.equal(harness.gate.isLocked(), true);
  harness.gate.api.unlock();
  harness.freeze();
  assert.equal(harness.gate.isLocked(), true);
});

test('bfcache pageshow locks synchronously while an ordinary pageshow does not duplicate the boot probe', async () => {
  const resumed = deferred();
  let calls = 0;
  const harness = createHeartbeatHarness(() => {
    calls += 1;
    if (calls === 1) {
      return Promise.resolve(jsonResponse(200, {
        authenticated: true,
        permission: 'annotate.access',
        ssoEnabled: true,
      }));
    }
    return resumed.promise;
  });

  harness.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(harness.gate.isLocked(), false);
  const unlockedGeneration = harness.gate.generation();

  harness.showPage(false);
  assert.equal(calls, 1);
  assert.equal(harness.gate.isLocked(), false);

  harness.showPage(true);

  assert.equal(calls, 2);
  assert.equal(harness.gate.isLocked(), true);
  assert.equal(harness.gate.api.allows(unlockedGeneration), false);
  resumed.resolve(jsonResponse(200, {
    authenticated: true,
    permission: 'annotate.access',
    ssoEnabled: true,
  }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(harness.gate.isLocked(), false);
});

test('an SSO-disabled response does not hide a later re-enable from the workbench', async () => {
  let calls = 0;
  const harness = createHeartbeatHarness(async () => {
    calls += 1;
    if (calls === 1) return jsonResponse(200, { authenticated: false, ssoEnabled: false });
    return jsonResponse(401, { authenticated: false, ssoEnabled: true });
  });
  const api = harness.api();

  await api.checkSession();
  assert.equal(harness.gate.isLocked(), false);

  await api.checkSession();

  assert.equal(calls, 2);
  assert.equal(harness.gate.isLocked(), true);
});

test('a stale successful probe cannot unlock a newer denied session', async () => {
  const staleSuccess = deferred();
  let calls = 0;
  const harness = createHeartbeatHarness(() => {
    calls += 1;
    if (calls === 1) return staleSuccess.promise;
    return Promise.resolve(jsonResponse(401, { authenticated: false, ssoEnabled: true }));
  });
  const api = harness.api();

  const staleProbe = api.checkSession();
  await api.checkSession();
  assert.equal(harness.gate.isLocked(), true);

  staleSuccess.resolve(jsonResponse(200, {
    authenticated: true,
    permission: 'annotate.access',
    ssoEnabled: true,
  }));
  await staleProbe;

  assert.equal(harness.gate.isLocked(), true);
  assert.equal(harness.gate.unlockCalls(), 0);
});

test('only the latest session-probe generation may change the workbench lock', async () => {
  const first = deferred();
  let calls = 0;
  let firstSignal;
  const harness = createHeartbeatHarness((_url, init) => {
    calls += 1;
    if (calls === 1) {
      firstSignal = init.signal;
      return first.promise;
    }
    return Promise.resolve(jsonResponse(200, {
      authenticated: true,
      permission: 'annotate.access',
      ssoEnabled: true,
    }));
  });
  const api = harness.api();
  assert.ok(api, 'heartbeat should expose its deterministic controller');

  const staleProbe = api.checkSession();
  await api.checkSession();
  assert.equal(firstSignal.aborted, true);
  assert.equal(harness.gate.isLocked(), false);

  first.resolve(jsonResponse(403, { authenticated: false, ssoEnabled: true }));
  await staleProbe;

  assert.equal(harness.gate.isLocked(), false);
  assert.equal(harness.gate.lockCalls(), 0);
});

test('a successful blog.access-only session response cannot unlock the annotation workbench', async () => {
  const harness = createHeartbeatHarness(async () => jsonResponse(200, {
    authenticated: true,
    permission: 'blog.access',
    ssoEnabled: true,
  }));
  const api = harness.api();
  assert.ok(api, 'heartbeat should expose its deterministic controller');

  await api.checkSession();

  assert.equal(harness.gate.isLocked(), true);
  assert.equal(harness.gate.lockCalls(), 1);
  assert.equal(harness.gate.unlockCalls(), 0);
});

test('Ctrl+Z cannot mutate annotations after the auth gate locks', () => {
  const context = {
    annotations: [{ id: 'ann-1' }],
    canMutateWorkbench: () => false,
    document: { activeElement: { tagName: 'DIV' } },
    renderAnnotationList: () => assert.fail('locked shortcut rendered annotations'),
    toast: () => assert.fail('locked shortcut emitted a toast'),
    updatePreview: () => assert.fail('locked shortcut updated the export preview'),
  };
  vm.runInNewContext(`${extractFunction('handleShortcuts')}; this.command = handleShortcuts;`, context);

  context.command({
    ctrlKey: true,
    key: 'z',
    preventDefault: () => {},
  });

  assert.equal(context.annotations.length, 1);
});

test('arrayBuffer and FileReader completions from an older auth generation cannot commit', async () => {
  let generation = 0;
  let locked = false;
  const read = deferred();
  let workbookReads = 0;
  const uploadContext = {
    XLSX: { read: () => { workbookReads += 1; return {}; } },
    canMutateWorkbench: token => !locked && (token === undefined || token === generation),
    captureWorkbenchGeneration: () => generation,
    console: { error: () => {}, log: () => {} },
    toast: () => {},
    window: { XLSX: {} },
  };
  vm.runInNewContext(`${extractFunction('handleOcFile')}; this.command = handleOcFile;`, uploadContext);

  const upload = uploadContext.command('centric', {
    name: 'centric.xlsx',
    arrayBuffer: () => read.promise,
  });
  locked = true;
  generation += 1;
  read.resolve(new ArrayBuffer(8));
  await upload;

  assert.equal(workbookReads, 0);

  let reader;
  let restored = 0;
  locked = false;
  const input = { files: [{ name: 'archive.json' }], value: 'selected' };
  const importContext = {
    FileReader: class {
      constructor() {
        reader = this;
      }
      readAsText() {}
    },
    annotations: [],
    canMutateWorkbench: token => !locked && (token === undefined || token === generation),
    captureWorkbenchGeneration: () => generation,
    console: { error: () => {} },
    restoreArchiveData: () => { restored += 1; },
    toast: () => {},
  };
  vm.runInNewContext(`${extractFunction('importArchiveFromInput')}; this.command = importArchiveFromInput;`, importContext);

  importContext.command(input);
  locked = true;
  generation += 1;
  reader.result = '{}';
  reader.onload();

  assert.equal(restored, 0);
  assert.equal(input.value, 'selected');
});

test('all workbench mutation entry points use the auth gate and locked events are captured', () => {
  const guardedCommands = [
    'previewOcNoiseFilterChange', 'commitOcNoiseFilterChange', 'handleOcFile',
    'runOcclusionAnalysis', 'clearOcAnalysis', 'startOcArchPlayback',
    'toggleOcArchPlayback', 'onOcArchDetailsToggle', 'generateOcAnnotations',
    'setTemplateSearch', 'selectTemplate', 'applyCombo', 'clearFormState',
    'clearCurrentInputsKeepTemplate', 'toggleNegativeTemplate', 'setAnnotationFilter',
    'setAnnotationGroupMode', 'addToothSelection', 'toggleToothSelection',
    'applyManualTeeth', 'toggleOption', 'setStatus', 'saveAsReview',
    'saveAnnotation', 'editAnnotation', 'copyAnnotationToForm',
    'duplicateAnnotation', 'loadLastAnnotation', 'loadAnnotationToForm',
    'toggleReview', 'deleteAnnotation', 'downloadJSON', 'downloadTSV',
    'copyJSON', 'importArchiveFromInput', 'restoreArchiveData', 'downloadFile',
    'setIntraoralPreviewImages', 'addIntraoralPreviewImages',
    'loadIntraoralPreviewFiles', 'openIntraoralPreview', 'closeIntraoralPreview',
    'toggleIntraoralPreview', 'stepIntraoralPreview', 'goIntraoralPreview',
    'toggleIntraoralPreviewFit', 'handlePreviewKeydown', 'handleShortcuts',
  ];

  for (const command of guardedCommands) {
    assert.match(
      extractFunction(command).slice(0, 360),
      /canMutateWorkbench/,
      `${command} should fail closed through the auth gate`,
    );
  }
  for (const eventType of ['beforeinput', 'change', 'click', 'drop', 'input', 'keydown', 'paste', 'submit']) {
    assert.match(workbench, new RegExp(`LOCKED_WORKBENCH_EVENTS[^;]+['"]${eventType}['"]`, 's'));
  }
  assert.match(workbench, /stopImmediatePropagation\(\)/);
});

test('the portal uses the canonical annotation origin and keeps the compact nav through 780px', () => {
  assert.match(siteData, /url:\s*'https:\/\/annotate\.periopact\.cn\/'/);
  assert.match(styles, /@media \(max-width: 780px\)\s*\{[\s\S]*?\.nav\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(styles, /@media \(max-width: 620px\)\s*\{[\s\S]*?\.shell\s*\{/);
});

test('npm test includes every SSO suite', () => {
  const suites = readdirSync(new URL('.', import.meta.url))
    .filter(name => /^sso-.*\.test\.mjs$/.test(name));
  for (const suite of suites) {
    assert.ok(packageJson.scripts.test.includes(`tests/${suite}`), `${suite} is missing from npm test`);
  }
});
