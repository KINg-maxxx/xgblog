import { currentSessionCookie, endSession, oidcFor } from '../_shared/oidc-client.js';
import { getSiteConfig } from '../_shared/sso-config.js';
import { clearCookie, unsealCookie } from '../_shared/sealed-cookie.js';

const SESSION_COOKIE = '__Host-wxg_session';
const TRANSACTION_COOKIE = '__Host-wxg_sso_tx';

function clearHeaders() {
  const headers = new Headers();
  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  headers.append('Set-Cookie', clearCookie(TRANSACTION_COOKIE));
  return headers;
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  const headers = clearHeaders();
  try {
    const config = getSiteConfig(context.request, context.env);
    let idToken;
    const sealed = currentSessionCookie(context.request);
    if (sealed) {
      try {
        idToken = (await unsealCookie(sealed, config.cookieKey)).idToken;
      } catch {
        // A malformed local cookie must not prevent the user from ending the central session.
      }
    }
    const url = await endSession(config, idToken, oidcFor(context));
    headers.set('Location', url.href);
    return new Response(null, { status: 302, headers });
  } catch {
    return new Response('Authentication service is unavailable.', { status: 503, headers });
  }
}
