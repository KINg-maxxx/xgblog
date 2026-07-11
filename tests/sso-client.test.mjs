import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSiteConfig,
  validateReturnTo,
} from '../functions/_shared/sso-config.js';
import { sealCookie, unsealCookie } from '../functions/_shared/sealed-cookie.js';

const COOKIE_KEY = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc';
const env = {
  OIDC_ISSUER: 'https://www.periopact.cn/oidc',
  OIDC_COOKIE_KEY: COOKIE_KEY,
  BLOG_OIDC_CLIENT_SECRET: 'blog-secret',
  ANNOTATE_OIDC_CLIENT_SECRET: 'annotate-secret',
};

test('maps each exact xgblog host to its confidential client', () => {
  const blog = getSiteConfig(new Request('https://blog.periopact.cn/auth/login'), env);
  const annotation = getSiteConfig(new Request('https://annotate.periopact.cn/auth/login'), env);

  assert.deepEqual(
    { id: blog.clientId, permission: blog.permission, callback: blog.callbackUri },
    { id: 'wxg-blog', permission: 'blog.access', callback: 'https://blog.periopact.cn/auth/callback' },
  );
  assert.deepEqual(
    { id: annotation.clientId, permission: annotation.permission, callback: annotation.callbackUri },
    { id: 'wxg-annotate', permission: 'annotate.access', callback: 'https://annotate.periopact.cn/auth/callback' },
  );
  assert.throws(
    () => getSiteConfig(new Request('https://xgblog.pages.dev/auth/login'), env),
    /Unsupported SSO host/,
  );
});

test('only accepts exact relative return paths for the selected site', () => {
  const blog = getSiteConfig(new Request('https://blog.periopact.cn/auth/login'), env);
  assert.equal(validateReturnTo('/', blog), '/');
  assert.equal(validateReturnTo('/blog/', blog), '/blog/');
  assert.equal(validateReturnTo('https://attacker.example/', blog), '/');
  assert.equal(validateReturnTo('//attacker.example/', blog), '/');
  assert.equal(validateReturnTo('/blog/?next=https://attacker.example/', blog), '/');
});

test('seals cookie payloads as tamper-evident JWE', async () => {
  const payload = { state: 'state-value', verifier: 'pkce-value', expiresAt: Date.now() + 300_000 };
  const sealed = await sealCookie(payload, COOKIE_KEY);

  assert.notEqual(sealed, JSON.stringify(payload));
  assert.deepEqual(await unsealCookie(sealed, COOKIE_KEY), payload);
  await assert.rejects(() => unsealCookie(`x${sealed.slice(1)}`, COOKIE_KEY));
});
