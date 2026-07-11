import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequest as login } from '../functions/auth/login.js';
import { onRequest as callback } from '../functions/auth/callback.js';
import { onRequest as logout } from '../functions/auth/logout.js';
import { onRequest as session } from '../functions/api/auth/session.js';
import { sealCookie, unsealCookie } from '../functions/_shared/sealed-cookie.js';

const COOKIE_KEY = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc';
const env = {
  OIDC_ISSUER: 'https://www.periopact.cn/oidc',
  OIDC_COOKIE_KEY: COOKIE_KEY,
  BLOG_OIDC_CLIENT_SECRET: 'blog-secret',
  ANNOTATE_OIDC_CLIENT_SECRET: 'annotate-secret',
};

function cookies(response) {
  return response.headers.getSetCookie?.() || [response.headers.get('Set-Cookie') || ''];
}

function request(url, cookie = '') {
  return new Request(url, { headers: cookie ? { Cookie: cookie } : undefined });
}

function context(url, { cookie, oidc, logs = [] } = {}) {
  return { request: request(url, cookie), env, data: { oidc, log: entry => logs.push(entry) } };
}

function oidcAdapter({ outage = false } = {}) {
  return {
    randomState: () => 'state-value',
    randomNonce: () => 'nonce-value',
    randomPKCECodeVerifier: () => 'pkce-verifier',
    calculatePKCECodeChallenge: async verifier => `challenge-for-${verifier}`,
    discovery: async () => {
      if (outage) throw new Error('issuer unavailable');
      return { issuer: 'configured' };
    },
    buildAuthorizationUrl: (_configuration, parameters) => new URL(
      `https://www.periopact.cn/oidc/auth?${new URLSearchParams(parameters)}`,
    ),
    authorizationCodeGrant: async (_configuration, currentUrl, checks) => {
      assert.equal(currentUrl.searchParams.get('state'), checks.expectedState);
      assert.equal(checks.expectedNonce, 'nonce-value');
      assert.equal(checks.pkceCodeVerifier, 'pkce-verifier');
      return { access_token: 'access-token', id_token: 'id-token', expires_in: 600 };
    },
    tokenIntrospection: async (_configuration, token) => {
      assert.equal(token, 'access-token');
      return {
        active: true,
        sub: 'user-1',
        name: 'Alice',
        picture: 'avatar-1',
        'https://periopact.cn/claims/app_access': 'blog.access',
      };
    },
    buildEndSessionUrl: (_configuration, parameters) => new URL(
      `https://www.periopact.cn/oidc/session/end?${new URLSearchParams(parameters)}`,
    ),
  };
}

test('login uses PKCE S256, saves a five-minute transaction, and redacts credentials from logs', async () => {
  const logs = [];
  const response = await login(context('https://blog.periopact.cn/auth/login?returnTo=/blog/', {
    oidc: oidcAdapter(), logs,
  }));
  const location = new URL(response.headers.get('Location'));
  const setCookie = cookies(response)[0];
  const transaction = await unsealCookie(setCookie.match(/__Host-wxg_sso_tx=([^;]+)/)[1], COOKIE_KEY);

  assert.equal(response.status, 302);
  assert.equal(location.searchParams.get('client_id'), 'wxg-blog');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://blog.periopact.cn/auth/callback');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(location.searchParams.get('code_challenge'), 'challenge-for-pkce-verifier');
  assert.match(setCookie, /HttpOnly; Secure; SameSite=Lax; Path=\//);
  assert.doesNotMatch(setCookie, /Domain=/);
  assert.ok(transaction.expiresAt > Date.now());
  assert.ok(transaction.expiresAt <= Date.now() + 300_000);
  assert.equal(transaction.returnTo, '/blog/');
  assert.deepEqual(logs, [{ component: 'sso', event: 'login_started' }]);
  assert.doesNotMatch(JSON.stringify(logs), /access-token|id-token|blog-secret|pkce-verifier|Cookie/);
});

test('callback exchanges the code server-side, clears its transaction, and redirects without callback parameters', async () => {
  const logs = [];
  const loginResponse = await login(context('https://blog.periopact.cn/auth/login?returnTo=/', { oidc: oidcAdapter() }));
  const transactionCookie = cookies(loginResponse)[0].split(';')[0];
  const response = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: transactionCookie, oidc: oidcAdapter(), logs },
  ));
  const setCookies = cookies(response).join('\n');

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), 'https://blog.periopact.cn/');
  assert.match(setCookies, /__Host-wxg_session=/);
  assert.match(setCookies, /__Host-wxg_sso_tx=;[^\n]*Max-Age=0/);
  assert.match(setCookies, /HttpOnly; Secure; SameSite=Lax; Path=\//);
  assert.doesNotMatch(setCookies, /Domain=|access-token|id-token|authorization-code/);
  assert.deepEqual(logs, [{ component: 'sso', event: 'login_completed' }]);
  assert.doesNotMatch(JSON.stringify(logs), /authorization-code|access-token|id-token|blog-secret|pkce-verifier|Cookie/);
});

test('callback rejects a token response without a positive expiry', async () => {
  const loginResponse = await login(context('https://blog.periopact.cn/auth/login', { oidc: oidcAdapter() }));
  const transactionCookie = cookies(loginResponse)[0].split(';')[0];
  const adapter = { ...oidcAdapter(), authorizationCodeGrant: async () => ({
    access_token: 'access-token', id_token: 'id-token', expires_in: 'not-a-number',
  }) };
  const response = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: transactionCookie, oidc: adapter },
  ));

  assert.equal(response.status, 400);
  assert.doesNotMatch(cookies(response).join('\n'), /__Host-wxg_session=/);
});

test('callback rejects expired transactions without exchanging credentials', async () => {
  const expired = await sealCookie({
    state: 'state-value', nonce: 'nonce-value', verifier: 'pkce-verifier', returnTo: '/', expiresAt: Date.now() - 1,
  }, COOKIE_KEY);
  let exchanged = false;
  const adapter = { ...oidcAdapter(), authorizationCodeGrant: async () => { exchanged = true; } };
  const response = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: `__Host-wxg_sso_tx=${expired}`, oidc: adapter },
  ));

  assert.equal(response.status, 400);
  assert.equal(exchanged, false);
  assert.match(cookies(response).join('\n'), /__Host-wxg_sso_tx=;[^\n]*Max-Age=0/);
});

test('callback delegates state, nonce, and PKCE verification to openid-client', async () => {
  const transaction = await sealCookie({
    state: 'state-value', nonce: 'nonce-value', verifier: 'pkce-verifier', returnTo: '/', expiresAt: Date.now() + 60_000,
  }, COOKIE_KEY);
  let checks;
  const adapter = {
    ...oidcAdapter(),
    authorizationCodeGrant: async (_configuration, callbackUrl, receivedChecks) => {
      checks = receivedChecks;
      assert.equal(callbackUrl.searchParams.get('state'), 'wrong-state');
      throw new Error('OIDC callback validation failed');
    },
  };
  const response = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=wrong-state',
    { cookie: `__Host-wxg_sso_tx=${transaction}`, oidc: adapter },
  ));

  assert.equal(response.status, 400);
  assert.deepEqual(checks, {
    expectedState: 'state-value', expectedNonce: 'nonce-value', pkceCodeVerifier: 'pkce-verifier',
  });
});

test('issuer outages fail closed and structured logs never contain callback material', async () => {
  const logs = [];
  const response = await login(context('https://blog.periopact.cn/auth/login?returnTo=/&code=secret-code', {
    oidc: oidcAdapter({ outage: true }), logs,
  }));

  assert.equal(response.status, 503);
  assert.deepEqual(logs, [{ component: 'sso', event: 'login_unavailable' }]);
  assert.doesNotMatch(JSON.stringify(logs), /secret-code|access-token|id-token|blog-secret|Cookie|pkce-verifier/);
});

test('session introspects opaque tokens and returns only the minimal identity and permission', async () => {
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const response = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: oidcAdapter(),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: true,
    user: { id: 'user-1', name: 'Alice', picture: 'avatar-1' },
    permission: 'blog.access',
  });
});

test('session fails closed and clears the local cookie when introspection rejects the token', async () => {
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const adapter = { ...oidcAdapter(), tokenIntrospection: async () => ({ active: false }) };
  const response = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: adapter,
  }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false });
  assert.match(cookies(response).join('\n'), /__Host-wxg_session=;[^\n]*Max-Age=0/);
});

test('logout clears host-only cookies and sends an RP-initiated logout request', async () => {
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const response = await logout(context('https://blog.periopact.cn/auth/logout', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: oidcAdapter(),
  }));
  const location = new URL(response.headers.get('Location'));
  const setCookies = cookies(response).join('\n');

  assert.equal(response.status, 302);
  assert.equal(location.origin + location.pathname, 'https://www.periopact.cn/oidc/session/end');
  assert.equal(location.searchParams.get('id_token_hint'), 'id-token');
  assert.equal(location.searchParams.get('post_logout_redirect_uri'), 'https://blog.periopact.cn/');
  assert.match(setCookies, /__Host-wxg_session=;[^\n]*Max-Age=0/);
  assert.match(setCookies, /__Host-wxg_sso_tx=;[^\n]*Max-Age=0/);
  assert.match(setCookies, /HttpOnly; Secure; SameSite=Lax; Path=\//);
  assert.doesNotMatch(setCookies, /Domain=/);
});
