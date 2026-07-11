import { base64url } from 'jose';

import { readCookie, sealCookie, unsealCookie } from './sealed-cookie.js';

const SESSION_COOKIE = '__Host-wxg_session';
const TOKEN_TTL_MS = 5 * 60_000;
const encoder = new TextEncoder();

async function sessionFingerprint(request) {
  const session = readCookie(request, SESSION_COOKIE);
  if (!session) throw new Error('Missing session');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(session));
  return base64url.encode(new Uint8Array(digest));
}

function requestSource(request) {
  return request.headers.get('Origin') || request.headers.get('Referer');
}

function isSameOrigin(request) {
  const source = requestSource(request);
  if (!source || source === 'null') return false;
  try {
    return new URL(source).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function requestToken(request) {
  const header = request.headers.get('X-CSRF-Token');
  if (header) return header;
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.startsWith('application/x-www-form-urlencoded')) return '';
  return String((await request.formData()).get('csrfToken') || '');
}

export async function createCsrfToken(request, config, action) {
  return sealCookie({
    version: 1,
    action,
    method: 'POST',
    origin: new URL(request.url).origin,
    session: await sessionFingerprint(request),
    nonce: crypto.randomUUID(),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  }, config.cookieKey);
}

export async function verifyCsrfRequest(request, config, action) {
  if (request.method !== 'POST' || !isSameOrigin(request)) return false;
  try {
    const token = await requestToken(request);
    if (!token) return false;
    const payload = await unsealCookie(token, config.cookieKey);
    return payload.version === 1
      && payload.action === action
      && payload.method === request.method
      && payload.origin === new URL(request.url).origin
      && typeof payload.nonce === 'string'
      && payload.nonce.length > 0
      && Number.isFinite(payload.expiresAt)
      && payload.expiresAt > Date.now()
      && payload.expiresAt <= Date.now() + TOKEN_TTL_MS
      && payload.session === await sessionFingerprint(request);
  } catch {
    return false;
  }
}
