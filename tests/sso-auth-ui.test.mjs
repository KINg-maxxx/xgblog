import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanOidcCallbackParameters,
  fetchAuthState,
  getLoginHref,
} from '../src/auth.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('auth session responses map to stable UI states', async () => {
  const authenticated = await fetchAuthState(async () => jsonResponse(200, {
    authenticated: true,
    ssoEnabled: true,
    user: { id: 'user-1', name: 'Alice' },
    csrfToken: 'csrf-token',
  }));
  const anonymous = await fetchAuthState(async () => jsonResponse(401, { authenticated: false, ssoEnabled: true }));
  const denied = await fetchAuthState(async () => jsonResponse(403, { authenticated: false, ssoEnabled: true }));
  const unavailable = await fetchAuthState(async () => jsonResponse(503, { authenticated: false, ssoEnabled: true }));
  const disabled = await fetchAuthState(async () => jsonResponse(200, { authenticated: false, ssoEnabled: false }));

  assert.deepEqual(authenticated, {
    state: 'authenticated',
    user: { id: 'user-1', name: 'Alice' },
    csrfToken: 'csrf-token',
  });
  assert.equal(anonymous.state, 'anonymous');
  assert.equal(denied.state, 'denied');
  assert.equal(unavailable.state, 'unavailable');
  assert.equal(disabled.state, 'disabled');
});

test('network and malformed session responses fail to the unavailable state', async () => {
  assert.equal((await fetchAuthState(async () => { throw new TypeError('offline'); })).state, 'unavailable');
  assert.equal((await fetchAuthState(async () => jsonResponse(200, { authenticated: true }))).state, 'unavailable');
});

test('login links use only return paths accepted by the confidential client', () => {
  assert.equal(getLoginHref({ pathname: '/' }), '/auth/login?returnTo=%2F');
  assert.equal(getLoginHref({ pathname: '/blog/index.html' }), '/auth/login?returnTo=%2Fblog%2F');
  assert.equal(getLoginHref({ pathname: '/blog/first-essay.html' }), '/auth/login?returnTo=%2Fblog%2F');
});

test('OIDC callback cleanup preserves unrelated query and hash before app startup', () => {
  let replacement;
  const changed = cleanOidcCallbackParameters(
    { href: 'https://blog.periopact.cn/?post=hello&code=secret&state=state&session_state=sid#notes' },
    { replaceState: (_state, _title, url) => { replacement = url; } },
  );

  assert.equal(changed, true);
  assert.equal(replacement, '/?post=hello#notes');

  replacement = undefined;
  const untouched = cleanOidcCallbackParameters(
    { href: 'https://blog.periopact.cn/?code=article-example#notes' },
    { replaceState: (_state, _title, url) => { replacement = url; } },
  );
  assert.equal(untouched, false);
  assert.equal(replacement, undefined);
});
