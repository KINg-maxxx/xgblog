import {
  completeAuthorization,
  isOidcProviderUnavailable,
  OidcCallbackRejectedError,
  OidcProviderUnavailableError,
  oidcFor,
} from '../_shared/oidc-client.js';
import { auditSsoEvent } from '../_shared/sso-audit.js';
import { getSiteConfig, validateReturnTo } from '../_shared/sso-config.js';
import { clearCookie, readCookie, sealCookie, secureCookie, unsealCookie } from '../_shared/sealed-cookie.js';

const SESSION_COOKIE = '__Host-wxg_session';
const TRANSACTION_COOKIE = '__Host-wxg_sso_tx';
const MAX_COOKIE_BYTES = 4096;

function rejectCallback(reason) {
  throw new OidcCallbackRejectedError(reason);
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  let config;
  try {
    config = getSiteConfig(context.request, context.env);
    const sealed = readCookie(context.request, TRANSACTION_COOKIE);
    const transaction = await unsealCookie(sealed, config.cookieKey);
    if (!transaction.state || !transaction.nonce || !transaction.verifier || transaction.expiresAt <= Date.now()) {
      rejectCallback('invalid_transaction');
    }
    if (validateReturnTo(transaction.returnTo, config) !== transaction.returnTo) rejectCallback('invalid_return_path');
    const session = await completeAuthorization(config, context.request, transaction, oidcFor(context));
    if (session.expiresAt <= Date.now()) rejectCallback('expired_session');
    const sessionCookie = await sealCookie(session, config.cookieKey);
    const maxAge = Math.floor((session.expiresAt - Date.now()) / 1000);
    if (maxAge <= 0) throw new OidcProviderUnavailableError('invalid_expiry_evidence');
    const serializedSessionCookie = secureCookie(SESSION_COOKIE, sessionCookie, maxAge);
    if (new TextEncoder().encode(serializedSessionCookie).byteLength > MAX_COOKIE_BYTES) {
      throw new OidcProviderUnavailableError('session_cookie_too_large');
    }
    auditSsoEvent(context, config, 'callback_completed', 302, 'authorized');
    const headers = new Headers({ Location: new URL(transaction.returnTo, config.origin).href });
    headers.append('Set-Cookie', serializedSessionCookie);
    headers.append('Set-Cookie', clearCookie(TRANSACTION_COOKIE));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    const unavailable = isOidcProviderUnavailable(error) || !config;
    const status = unavailable ? 503 : 400;
    auditSsoEvent(
      context,
      config,
      unavailable ? 'callback_unavailable' : 'callback_rejected',
      status,
      unavailable ? error.reason || 'configuration_unavailable' : error.reason || 'invalid_callback',
    );
    return new Response(unavailable ? 'Authentication service is unavailable.' : 'Authentication callback was rejected.', {
      status,
      headers: { 'Set-Cookie': clearCookie(TRANSACTION_COOKIE) },
    });
  }
}
