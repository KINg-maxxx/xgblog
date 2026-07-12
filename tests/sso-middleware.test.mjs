import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequest as middleware } from '../functions/_middleware.js';
import { sealCookie } from '../functions/_shared/sealed-cookie.js';
import { onRequest as session } from '../functions/api/auth/session.js';

const COOKIE_KEY = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc';
const PACT_EXPIRY = 'https://periopact.cn/claims/sso_expires_at';
const env = {
  SSO_ENABLED: '1',
  OIDC_ISSUER: 'https://www.periopact.cn/oidc',
  OIDC_COOKIE_KEY: COOKIE_KEY,
  BLOG_OIDC_CLIENT_SECRET: 'blog-secret',
  ANNOTATE_OIDC_CLIENT_SECRET: 'annotation-secret',
};

function pactExpiry() {
  return Math.floor((Date.now() + 10 * 60_000) / 1000);
}

function oidcAdapter({ access = 'annotate.access', outage = false } = {}) {
  let introspections = 0;
  return {
    discovery: async () => ({ issuer: 'configured' }),
    tokenIntrospection: async () => {
      introspections += 1;
      if (outage) throw new TypeError('provider unavailable');
      return {
        active: true,
        sub: 'user-1',
        name: 'Alice',
        'https://periopact.cn/claims/app_access': access,
        [PACT_EXPIRY]: pactExpiry(),
      };
    },
    introspections: () => introspections,
  };
}

function makeContext(url, { cookie = '', envOverrides = {}, oidc = oidcAdapter() } = {}) {
  const headers = new Headers(cookie ? { Cookie: cookie } : undefined);
  let nextInput;
  let nextCalls = 0;
  const context = {
    request: new Request(url, { headers }),
    env: { ...env, ...envOverrides },
    data: { oidc, log: () => {} },
    next: async input => {
      nextCalls += 1;
      nextInput = input;
      return new Response('next');
    },
  };
  return {
    context,
    nextCalls: () => nextCalls,
    nextRequest: () => nextInput,
  };
}

async function activeCookie() {
  const value = await sealCookie({
    accessToken: 'access-token',
    idToken: 'id-token',
    expiresAt: Date.now() + 5 * 60_000,
  }, COOKIE_KEY);
  return `__Host-wxg_session=${value}`;
}

test('blog content remains public and never introspects an anonymous request', async () => {
  const oidc = oidcAdapter();
  const probe = makeContext('https://blog.periopact.cn/blog/?post=public', { oidc });

  const response = await middleware(probe.context);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'next');
  assert.equal(probe.nextCalls(), 1);
  assert.equal(probe.nextRequest(), undefined);
  assert.equal(oidc.introspections(), 0);
});

test('workbench aliases on production and alternate hosts redirect to the canonical annotation entry', async () => {
  const cases = [
    ['blog.periopact.cn', '/tools/annotation-workbench.html'],
    ['blog.periopact.cn', '/tools/annotation-workbench'],
    ['xgblog.pages.dev', '/%74ools/annotation-workbench.html'],
    ['xgblog.pages.dev', '/%74ools/annotation-workbench'],
    ['preview.example', '/tools/%61nnotation-workbench.html'],
    ['preview.example', '/tools/%61nnotation-workbench'],
    ['preview.example', '/tools/annotation-workbench%2ehtml'],
  ];
  for (const [host, path] of cases) {
    const label = `${host}${path}`;
    const oidc = oidcAdapter();
    const probe = makeContext(`https://${host}${path}?case=P0001`, { oidc });

    const response = await middleware(probe.context);

    assert.equal(response.status, 308, label);
    assert.equal(response.headers.get('Location'), 'https://annotate.periopact.cn/', label);
    assert.equal(response.headers.get('Cache-Control'), 'no-store', label);
    assert.equal(probe.nextCalls(), 0, label);
    assert.equal(oidc.introspections(), 0, label);
  }
});

test('annotation-host workbench aliases are protected and rewritten to the canonical asset', async () => {
  const cookie = await activeCookie();
  const cases = [
    '/tools/annotation-workbench',
    '/%74ools/annotation-workbench',
    '/tools/%61nnotation-workbench',
    '/tools/annotation-workbench%2ehtml',
  ];

  for (const path of cases) {
    const oidc = oidcAdapter();
    const probe = makeContext(`https://annotate.periopact.cn${path}?case=P0001`, { cookie, oidc });

    const response = await middleware(probe.context);

    assert.equal(response.status, 200, path);
    assert.equal(new URL(probe.nextRequest().url).pathname, '/tools/annotation-workbench.html', path);
    assert.equal(oidc.introspections(), 1, path);
  }
});

test('disabled SSO keeps the annotation workbench public while preserving the host rewrite', async () => {
  const oidc = oidcAdapter();
  const probe = makeContext('https://annotate.periopact.cn/', {
    envOverrides: { SSO_ENABLED: '0' },
    oidc,
  });

  const response = await middleware(probe.context);
  const rewritten = new URL(probe.nextRequest().url);

  assert.equal(response.status, 200);
  assert.equal(rewritten.pathname, '/tools/annotation-workbench.html');
  assert.equal(oidc.introspections(), 0);
});

test('disabled SSO still canonicalizes the Cloudflare extensionless annotation route', async () => {
  const oidc = oidcAdapter();
  const probe = makeContext('https://annotate.periopact.cn/tools/annotation-workbench', {
    envOverrides: { SSO_ENABLED: '0' },
    oidc,
  });

  const response = await middleware(probe.context);

  assert.equal(response.status, 200);
  assert.equal(new URL(probe.nextRequest().url).pathname, '/tools/annotation-workbench.html');
  assert.equal(oidc.introspections(), 0);
});

test('annotation entry redirects an anonymous request to login without looping auth routes', async () => {
  const entry = makeContext('https://annotate.periopact.cn/');
  const response = await middleware(entry.context);

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get('Location'),
    'https://annotate.periopact.cn/auth/login?returnTo=%2Ftools%2Fannotation-workbench.html',
  );
  assert.equal(entry.nextCalls(), 0);

  const login = makeContext('https://annotate.periopact.cn/auth/login');
  assert.equal((await middleware(login.context)).status, 200);
  assert.equal(login.nextCalls(), 1);
});

test('authorized annotation entry introspects once and rewrites root to the workbench', async () => {
  const oidc = oidcAdapter();
  const probe = makeContext('https://annotate.periopact.cn/', {
    cookie: await activeCookie(),
    oidc,
  });

  const response = await middleware(probe.context);

  assert.equal(response.status, 200);
  assert.equal(new URL(probe.nextRequest().url).pathname, '/tools/annotation-workbench.html');
  assert.equal(oidc.introspections(), 1);
});

test('a blog-only session cannot enter the annotation root', async () => {
  const oidc = oidcAdapter({ access: 'blog.access' });
  const probe = makeContext('https://annotate.periopact.cn/', {
    cookie: await activeCookie(),
    oidc,
  });

  const response = await middleware(probe.context);

  assert.equal(response.status, 403);
  assert.equal(probe.nextCalls(), 0);
  assert.equal(oidc.introspections(), 1);
  assert.match(response.headers.get('Set-Cookie'), /__Host-wxg_session=;.*Max-Age=0/);
});

test('annotation fails closed on revoked access and identity-provider outages', async () => {
  const cookie = await activeCookie();
  const denied = makeContext('https://annotate.periopact.cn/tools/annotation-workbench', {
    cookie,
    oidc: oidcAdapter({ access: 'blog.access' }),
  });
  const unavailable = makeContext('https://annotate.periopact.cn/%74ools/annotation-workbench', {
    cookie,
    oidc: oidcAdapter({ outage: true }),
  });

  const deniedResponse = await middleware(denied.context);
  const unavailableResponse = await middleware(unavailable.context);

  assert.equal(deniedResponse.status, 403);
  assert.equal(unavailableResponse.status, 503);
  assert.match(deniedResponse.headers.get('Set-Cookie'), /__Host-wxg_session=;.*Max-Age=0/);
  assert.equal(denied.nextCalls(), 0);
  assert.equal(unavailable.nextCalls(), 0);
});

test('disabled session endpoint is public and performs no introspection', async () => {
  const oidc = oidcAdapter();
  const response = await session({
    request: new Request('https://blog.periopact.cn/api/auth/session'),
    env: { SSO_ENABLED: '0' },
    data: { oidc, log: () => {} },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false, ssoEnabled: false });
  assert.equal(oidc.introspections(), 0);
});
