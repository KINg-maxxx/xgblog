import { completeAuthorization, oidcFor } from '../_shared/oidc-client.js';
import { getSiteConfig, validateReturnTo } from '../_shared/sso-config.js';
import { clearCookie, readCookie, sealCookie, secureCookie, unsealCookie } from '../_shared/sealed-cookie.js';

const SESSION_COOKIE = '__Host-wxg_session';
const TRANSACTION_COOKIE = '__Host-wxg_sso_tx';

function audit(context, event) {
  const entry = { component: 'sso', event };
  if (typeof context.data?.log === 'function') context.data.log(entry);
  else console.warn(JSON.stringify(entry));
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  let config;
  try {
    config = getSiteConfig(context.request, context.env);
    const sealed = readCookie(context.request, TRANSACTION_COOKIE);
    const transaction = await unsealCookie(sealed, config.cookieKey);
    if (!transaction.state || !transaction.nonce || !transaction.verifier || transaction.expiresAt <= Date.now()) {
      throw new Error('Invalid transaction');
    }
    if (validateReturnTo(transaction.returnTo, config) !== transaction.returnTo) throw new Error('Invalid return path');
    const session = await completeAuthorization(config, context.request, transaction, oidcFor(context));
    if (session.expiresAt <= Date.now()) throw new Error('Expired token response');
    const sessionCookie = await sealCookie(session, config.cookieKey);
    audit(context, 'login_completed');
    const headers = new Headers({ Location: new URL(transaction.returnTo, config.origin).href });
    headers.append('Set-Cookie', secureCookie(SESSION_COOKIE, sessionCookie, Math.ceil((session.expiresAt - Date.now()) / 1000)));
    headers.append('Set-Cookie', clearCookie(TRANSACTION_COOKIE));
    return new Response(null, { status: 302, headers });
  } catch {
    audit(context, 'callback_rejected');
    return new Response('Authentication callback was rejected.', {
      status: 400,
      headers: { 'Set-Cookie': clearCookie(TRANSACTION_COOKIE) },
    });
  }
}
