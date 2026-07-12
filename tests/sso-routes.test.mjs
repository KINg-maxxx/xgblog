import assert from 'node:assert/strict';
import test from 'node:test';
import { ClientError } from 'openid-client';

import { onRequest as login } from '../functions/auth/login.js';
import { onRequest as callback } from '../functions/auth/callback.js';
import { onRequest as logout } from '../functions/auth/logout.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import { onRequest as session } from '../functions/api/auth/session.js';
import { sealCookie, unsealCookie } from '../functions/_shared/sealed-cookie.js';

const COOKIE_KEY = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc';
const MAX_BROWSER_COOKIE_BYTES = 4096;
const PACT_SSO_EXPIRES_AT_CLAIM = 'https://periopact.cn/claims/sso_expires_at';
const env = {
  SSO_ENABLED: '1',
  OIDC_ISSUER: 'https://www.periopact.cn/oidc',
  OIDC_COOKIE_KEY: COOKIE_KEY,
  BLOG_OIDC_CLIENT_SECRET: 'blog-secret',
  ANNOTATE_OIDC_CLIENT_SECRET: 'annotate-secret',
};

function cookies(response) {
  return response.headers.getSetCookie?.() || [response.headers.get('Set-Cookie') || ''];
}

function request(url, cookie = '', traceId, init = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set('Cookie', cookie);
  if (traceId) headers.set('X-Trace-Id', traceId);
  return new Request(url, { ...init, headers });
}

function context(url, {
  cookie,
  oidc,
  logs = [],
  traceId = 'trace-test-000001',
  init,
  envOverrides = {},
} = {}) {
  return {
    request: request(url, cookie, traceId, init),
    env: { ...env, ...envOverrides },
    data: { oidc, log: entry => logs.push(entry), traceId },
  };
}

function pactExpiry(seconds = 600) {
  return Math.floor((Date.now() + seconds * 1000) / 1000);
}

function responseError(status, error) {
  const failure = new Error(error);
  failure.name = 'ResponseBodyError';
  failure.status = status;
  failure.error = error;
  return failure;
}

function oidcAdapter({
  discoveryOutage = false,
  introspectionOutage = false,
  permission = 'blog.access',
  tokenResponse,
} = {}) {
  return {
    randomState: () => 'state-value',
    randomNonce: () => 'nonce-value',
    randomPKCECodeVerifier: () => 'pkce-verifier',
    calculatePKCECodeChallenge: async verifier => `challenge-for-${verifier}`,
    discovery: async () => {
      if (discoveryOutage) throw new TypeError('issuer unavailable');
      return { issuer: 'configured' };
    },
    buildAuthorizationUrl: (_configuration, parameters) => new URL(
      `https://www.periopact.cn/oidc/auth?${new URLSearchParams(parameters)}`,
    ),
    authorizationCodeGrant: async (_configuration, currentUrl, checks) => {
      assert.equal(currentUrl.searchParams.get('state'), checks.expectedState);
      assert.equal(checks.expectedNonce, 'nonce-value');
      assert.equal(checks.pkceCodeVerifier, 'pkce-verifier');
      return tokenResponse || {
        access_token: 'access-token', id_token: 'id-token', expires_in: 600,
        [PACT_SSO_EXPIRES_AT_CLAIM]: pactExpiry(),
      };
    },
    tokenIntrospection: async (_configuration, token) => {
      assert.equal(token, 'access-token');
      if (introspectionOutage) throw new TypeError('introspection unavailable');
      return {
        active: true,
        sub: 'user-1',
        name: 'Alice',
        picture: 'avatar-1',
        'https://periopact.cn/claims/app_access': permission,
        [PACT_SSO_EXPIRES_AT_CLAIM]: pactExpiry(),
      };
    },
    buildEndSessionUrl: (_configuration, parameters) => new URL(
      `https://www.periopact.cn/oidc/session/end?${new URLSearchParams(parameters)}`,
    ),
  };
}

function assertAudit(logs, entry) {
  assert.deepEqual(logs, [entry]);
  assert.deepEqual(Object.keys(logs[0]).sort(), ['clientId', 'event', 'reason', 'status', 'traceId']);
  assert.doesNotMatch(JSON.stringify(logs), /authorization-code|access-token|id-token|blog-secret|pkce-verifier|Cookie|Alice/);
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
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'login_started', status: 302, reason: 'authorization_started',
  });
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
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'callback_completed', status: 302, reason: 'authorized',
  });
});

test('callback derives sealed-session and cookie expiry from PACT absolute SSO expiry rather than access-token expires_in', async () => {
  const loginResponse = await login(context('https://blog.periopact.cn/auth/login', { oidc: oidcAdapter() }));
  const transactionCookie = cookies(loginResponse)[0].split(';')[0];
  const expiresAtSeconds = pactExpiry(90);
  const adapter = oidcAdapter({ tokenResponse: {
    access_token: 'access-token', id_token: 'id-token', expires_in: 8 * 60 * 60,
    [PACT_SSO_EXPIRES_AT_CLAIM]: expiresAtSeconds,
  } });
  const response = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: transactionCookie, oidc: adapter },
  ));

  const sessionCookie = cookies(response).find(value => value.startsWith('__Host-wxg_session='));
  const sealed = sessionCookie.match(/__Host-wxg_session=([^;]+)/)[1];
  const stored = await unsealCookie(sealed, COOKIE_KEY);
  const maxAge = Number(sessionCookie.match(/Max-Age=(\d+)/)[1]);

  assert.equal(response.status, 302);
  assert.ok(stored.expiresAt <= expiresAtSeconds * 1000);
  assert.ok(stored.expiresAt > Date.now());
  assert.ok(maxAge <= Math.floor((expiresAtSeconds * 1000 - Date.now()) / 1000));
});

test('callback bounds the complete browser session cookie', async () => {
  const loginResponse = await login(context('https://blog.periopact.cn/auth/login', { oidc: oidcAdapter() }));
  const transactionCookie = cookies(loginResponse)[0].split(';')[0];
  const response = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: transactionCookie, oidc: oidcAdapter() },
  ));
  const sessionCookie = cookies(response).find(value => value.startsWith('__Host-wxg_session='));

  assert.equal(response.status, 302);
  assert.ok(sessionCookie);
  assert.ok(
    new TextEncoder().encode(sessionCookie).byteLength <= MAX_BROWSER_COOKIE_BYTES,
    'the complete Set-Cookie value must fit practical browser limits',
  );
});

test('callback rejects oversized access and ID tokens without redirecting or retaining the transaction', async () => {
  for (const field of ['access_token', 'id_token']) {
    const logs = [];
    const loginResponse = await login(context('https://blog.periopact.cn/auth/login', { oidc: oidcAdapter() }));
    const transactionCookie = cookies(loginResponse)[0].split(';')[0];
    const tokenResponse = {
      access_token: 'access-token',
      id_token: 'id-token',
      [PACT_SSO_EXPIRES_AT_CLAIM]: pactExpiry(),
      [field]: 'x'.repeat(MAX_BROWSER_COOKIE_BYTES),
    };
    const response = await callback(context(
      'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
      { cookie: transactionCookie, oidc: oidcAdapter({ tokenResponse }), logs },
    ));
    const setCookies = cookies(response).join('\n');

    assert.equal(response.status, 503, field);
    assert.equal(response.headers.get('Location'), null, field);
    assert.doesNotMatch(setCookies, /__Host-wxg_session=/, field);
    assert.match(setCookies, /__Host-wxg_sso_tx=;[^\n]*Max-Age=0/, field);
    assertAudit(logs, {
      traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'callback_unavailable', status: 503, reason: 'session_cookie_too_large',
    });
  }
});

test('callback fails closed when PACT absolute expiry evidence is absent or invalid', async () => {
  const logs = [];
  const loginResponse = await login(context('https://blog.periopact.cn/auth/login', { oidc: oidcAdapter() }));
  const transactionCookie = cookies(loginResponse)[0].split(';')[0];
  const adapter = oidcAdapter({ tokenResponse: { access_token: 'access-token', id_token: 'id-token', expires_in: 600 } });
  const response = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: transactionCookie, oidc: adapter, logs },
  ));

  assert.equal(response.status, 503);
  assert.doesNotMatch(cookies(response).join('\n'), /__Host-wxg_session=/);
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'callback_unavailable', status: 503, reason: 'invalid_expiry_evidence',
  });

  const invalidLogs = [];
  const invalidLoginResponse = await login(context('https://blog.periopact.cn/auth/login', { oidc: oidcAdapter() }));
  const invalidTransactionCookie = cookies(invalidLoginResponse)[0].split(';')[0];
  const invalidAdapter = oidcAdapter({ tokenResponse: {
    access_token: 'access-token', id_token: 'id-token', [PACT_SSO_EXPIRES_AT_CLAIM]: String(pactExpiry()),
  } });
  const invalidResponse = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: invalidTransactionCookie, oidc: invalidAdapter, logs: invalidLogs },
  ));

  assert.equal(invalidResponse.status, 503);
  assertAudit(invalidLogs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'callback_unavailable', status: 503, reason: 'invalid_expiry_evidence',
  });
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
      throw responseError(400, 'invalid_request');
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

test('callback returns 400 and audits rejected callback material separately from provider availability', async () => {
  const logs = [];
  const transaction = await sealCookie({
    state: 'state-value', nonce: 'nonce-value', verifier: 'pkce-verifier', returnTo: '/', expiresAt: Date.now() + 60_000,
  }, COOKIE_KEY);
  const adapter = { ...oidcAdapter(), authorizationCodeGrant: async () => { throw responseError(400, 'invalid_grant'); } };
  const response = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: `__Host-wxg_sso_tx=${transaction}`, oidc: adapter, logs },
  ));

  assert.equal(response.status, 400);
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'callback_rejected', status: 400, reason: 'invalid_callback',
  });
});

test('real openid-client validation ClientErrors reject the callback instead of reporting an outage', async () => {
  const cases = [
    ['state', 'OAUTH_INVALID_RESPONSE'],
    ['nonce', 'OAUTH_JWT_CLAIM_COMPARISON_FAILED'],
  ];

  for (const [check, code] of cases) {
    const logs = [];
    const transaction = await sealCookie({
      state: 'state-value', nonce: 'nonce-value', verifier: 'pkce-verifier', returnTo: '/', expiresAt: Date.now() + 60_000,
    }, COOKIE_KEY);
    const adapter = {
      ...oidcAdapter(),
      authorizationCodeGrant: async () => {
        throw new ClientError(`invalid ${check} response`, { code });
      },
    };
    const response = await callback(context(
      'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
      { cookie: `__Host-wxg_sso_tx=${transaction}`, oidc: adapter, logs },
    ));

    assert.equal(response.status, 400, check);
    assertAudit(logs, {
      traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'callback_rejected', status: 400, reason: 'invalid_callback',
    });
  }
});

test('discovery and token endpoint outages return 503 rather than rejected callback status', async () => {
  const logs = [];
  const loginResponse = await login(context('https://blog.periopact.cn/auth/login', { oidc: oidcAdapter() }));
  const transactionCookie = cookies(loginResponse)[0].split(';')[0];
  const response = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: transactionCookie, oidc: oidcAdapter({ discoveryOutage: true }), logs },
  ));

  assert.equal(response.status, 503);
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'callback_unavailable', status: 503, reason: 'provider_unavailable',
  });

  const tokenLogs = [];
  const tokenLoginResponse = await login(context('https://blog.periopact.cn/auth/login', { oidc: oidcAdapter() }));
  const tokenTransactionCookie = cookies(tokenLoginResponse)[0].split(';')[0];
  const tokenOutageAdapter = { ...oidcAdapter(), authorizationCodeGrant: async () => { throw new TypeError('token endpoint unavailable'); } };
  const tokenResponse = await callback(context(
    'https://blog.periopact.cn/auth/callback?code=authorization-code&state=state-value',
    { cookie: tokenTransactionCookie, oidc: tokenOutageAdapter, logs: tokenLogs },
  ));

  assert.equal(tokenResponse.status, 503);
  assertAudit(tokenLogs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'callback_unavailable', status: 503, reason: 'provider_unavailable',
  });
});

test('issuer outages fail closed and structured logs never contain callback material', async () => {
  const logs = [];
  const response = await login(context('https://blog.periopact.cn/auth/login?returnTo=/&code=secret-code', {
    oidc: oidcAdapter({ discoveryOutage: true }), logs,
  }));

  assert.equal(response.status, 503);
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'login_unavailable', status: 503, reason: 'provider_unavailable',
  });
});

test('session introspects opaque tokens and returns only the minimal identity and permission', async () => {
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const response = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: oidcAdapter(),
  }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual({ ...body, csrfToken: '<redacted>' }, {
    authenticated: true,
    ssoEnabled: true,
    user: { id: 'user-1', name: 'Alice', picture: 'avatar-1' },
    permission: 'blog.access',
    csrfToken: '<redacted>',
  });
  assert.equal(typeof body.csrfToken, 'string');
  assert.ok(body.csrfToken.length > 40);
});

test('session fails closed, clears the local cookie, and audits inactive tokens', async () => {
  const logs = [];
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const adapter = { ...oidcAdapter(), tokenIntrospection: async () => ({ active: false }) };
  const response = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: adapter, logs,
  }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false });
  assert.match(cookies(response).join('\n'), /__Host-wxg_session=;[^\n]*Max-Age=0/);
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'session_inactive', status: 401, reason: 'inactive_token',
  });
});

test('session denies missing app permission and audits the denial', async () => {
  const logs = [];
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const adapter = { ...oidcAdapter(), tokenIntrospection: async () => ({
    active: true, sub: 'user-1', [PACT_SSO_EXPIRES_AT_CLAIM]: pactExpiry(),
  }) };
  const response = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: adapter, logs,
  }));

  assert.equal(response.status, 403);
  assert.match(cookies(response).join('\n'), /__Host-wxg_session=;[^\n]*Max-Age=0/);
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'session_denied', status: 403, reason: 'permission_denied',
  });
});

test('session fails closed and audits introspection outages and invalid expiry evidence', async () => {
  const logs = [];
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const response = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: oidcAdapter({ introspectionOutage: true }), logs,
  }));

  assert.equal(response.status, 503);
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'introspection_unavailable', status: 503, reason: 'provider_unavailable',
  });

  const missingEvidenceLogs = [];
  const missingEvidenceAdapter = { ...oidcAdapter(), tokenIntrospection: async () => ({
    active: true, sub: 'user-1', 'https://periopact.cn/claims/app_access': 'blog.access',
  }) };
  const missingEvidenceResponse = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: missingEvidenceAdapter, logs: missingEvidenceLogs,
  }));

  assert.equal(missingEvidenceResponse.status, 503);
  assertAudit(missingEvidenceLogs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'introspection_unavailable', status: 503, reason: 'invalid_expiry_evidence',
  });
});

test('session clears a sealed cookie whose expiry exceeds the current PACT session or grant bound', async () => {
  const logs = [];
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 10 * 60_000 }, COOKIE_KEY);
  const adapter = { ...oidcAdapter(), tokenIntrospection: async () => ({
    active: true,
    sub: 'user-1',
    'https://periopact.cn/claims/app_access': 'blog.access',
    [PACT_SSO_EXPIRES_AT_CLAIM]: pactExpiry(60),
  }) };
  const response = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: adapter, logs,
  }));

  assert.equal(response.status, 401);
  assert.match(cookies(response).join('\n'), /__Host-wxg_session=;[^\n]*Max-Age=0/);
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'session_inactive', status: 401, reason: 'expiry_bound_changed',
  });
});

test('logout clears host-only cookies, sends an RP-initiated logout request, and audits success', async () => {
  const logs = [];
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const sessionResponse = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: oidcAdapter(),
  }));
  const { csrfToken } = await sessionResponse.json();
  const response = await logout(context('https://blog.periopact.cn/auth/logout', {
    cookie: `__Host-wxg_session=${sealed}`, oidc: oidcAdapter(), logs,
    init: {
      method: 'POST',
      headers: {
        Origin: 'https://blog.periopact.cn',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrfToken }),
    },
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
  assertAudit(logs, {
    traceId: 'trace-test-000001', clientId: 'wxg-blog', event: 'logout_completed', status: 302, reason: 'logout_started',
  });
});

test('annotation logout uses PACT registered root redirect and root rewrites to the workbench', async () => {
  const adapter = oidcAdapter({ permission: 'annotate.access' });
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const cookie = `__Host-wxg_session=${sealed}`;
  const sessionResponse = await session(context('https://annotate.periopact.cn/api/auth/session', {
    cookie,
    oidc: adapter,
  }));
  const { csrfToken } = await sessionResponse.json();
  const logoutResponse = await logout(context('https://annotate.periopact.cn/auth/logout', {
    cookie,
    oidc: adapter,
    init: {
      method: 'POST',
      headers: {
        Origin: 'https://annotate.periopact.cn',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrfToken }),
    },
  }));
  const logoutLocation = new URL(logoutResponse.headers.get('Location'));

  let rewrittenRequest;
  const rootResponse = await middleware({
    request: request('https://annotate.periopact.cn/', cookie),
    env,
    data: { oidc: adapter, log: () => {} },
    next: async input => {
      rewrittenRequest = input;
      return new Response('next');
    },
  });

  assert.equal(logoutResponse.status, 302);
  assert.equal(logoutLocation.searchParams.get('post_logout_redirect_uri'), 'https://annotate.periopact.cn/');
  assert.equal(rootResponse.status, 200);
  assert.equal(new URL(rewrittenRequest.url).pathname, '/tools/annotation-workbench');
});

test('logout rejects GET, cross-origin POST, and a CSRF token bound to another local session', async () => {
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const otherSealed = await sealCookie({ accessToken: 'other-token', idToken: 'other-id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const cookie = `__Host-wxg_session=${sealed}`;
  const tokenResponse = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie, oidc: oidcAdapter(),
  }));
  const { csrfToken } = await tokenResponse.json();

  const getResponse = await logout(context('https://blog.periopact.cn/auth/logout', { cookie, oidc: oidcAdapter() }));
  const crossOrigin = await logout(context('https://blog.periopact.cn/auth/logout', {
    cookie,
    oidc: oidcAdapter(),
    init: {
      method: 'POST',
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken }),
    },
  }));
  const otherSession = await logout(context('https://blog.periopact.cn/auth/logout', {
    cookie: `__Host-wxg_session=${otherSealed}`,
    oidc: oidcAdapter(),
    init: {
      method: 'POST',
      headers: { Referer: 'https://blog.periopact.cn/', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken }),
    },
  }));

  assert.equal(getResponse.status, 405);
  assert.equal(crossOrigin.status, 403);
  assert.equal(otherSession.status, 403);
  assert.equal(crossOrigin.headers.get('Set-Cookie'), null);
  assert.equal(otherSession.headers.get('Set-Cookie'), null);
});

test('logout accepts a same-origin Referer and never clears cookies before configuration and CSRF validation', async () => {
  const sealed = await sealCookie({ accessToken: 'access-token', idToken: 'id-token', expiresAt: Date.now() + 60_000 }, COOKIE_KEY);
  const cookie = `__Host-wxg_session=${sealed}`;
  const tokenResponse = await session(context('https://blog.periopact.cn/api/auth/session', {
    cookie, oidc: oidcAdapter(),
  }));
  const { csrfToken } = await tokenResponse.json();
  const validReferer = await logout(context('https://blog.periopact.cn/auth/logout', {
    cookie,
    oidc: oidcAdapter(),
    init: {
      method: 'POST',
      headers: { Referer: 'https://blog.periopact.cn/account', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken }),
    },
  }));
  const brokenConfiguration = await logout(context('https://blog.periopact.cn/auth/logout', {
    cookie,
    oidc: oidcAdapter(),
    envOverrides: { OIDC_COOKIE_KEY: '' },
    init: {
      method: 'POST',
      headers: { Origin: 'https://blog.periopact.cn', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken }),
    },
  }));

  assert.equal(validReferer.status, 302);
  assert.equal(brokenConfiguration.status, 503);
  assert.equal(brokenConfiguration.headers.get('Set-Cookie'), null);
});
