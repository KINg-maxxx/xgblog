import { currentSessionCookie, endSession, oidcFor } from '../_shared/oidc-client.js';
import { verifyCsrfRequest } from '../_shared/csrf.js';
import { auditSsoEvent } from '../_shared/sso-audit.js';
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
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  let config;
  let headers;
  try {
    config = getSiteConfig(context.request, context.env);
    if (!await verifyCsrfRequest(context.request, config, 'logout')) {
      auditSsoEvent(context, config, 'logout_rejected', 403, 'csrf_rejected');
      return new Response('Logout request was rejected.', { status: 403 });
    }
    headers = clearHeaders();
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
    auditSsoEvent(context, config, 'logout_completed', 302, 'logout_started');
    return new Response(null, { status: 302, headers });
  } catch {
    auditSsoEvent(context, config, 'logout_unavailable', 503, config ? 'provider_unavailable' : 'configuration_unavailable');
    return new Response('Authentication service is unavailable.', {
      status: 503,
      ...(headers ? { headers } : {}),
    });
  }
}
