import { beginAuthorization, oidcFor } from '../_shared/oidc-client.js';
import { auditSsoEvent } from '../_shared/sso-audit.js';
import { getSiteConfig, validateReturnTo } from '../_shared/sso-config.js';
import { sealCookie, secureCookie } from '../_shared/sealed-cookie.js';

const TRANSACTION_COOKIE = '__Host-wxg_sso_tx';

export async function onRequest(context) {
  if (context.request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  let config;
  try {
    config = getSiteConfig(context.request, context.env);
    const returnTo = validateReturnTo(new URL(context.request.url).searchParams.get('returnTo'), config);
    const { transaction, url } = await beginAuthorization(config, returnTo, oidcFor(context));
    const sealed = await sealCookie(transaction, config.cookieKey);
    auditSsoEvent(context, config, 'login_started', 302, 'authorization_started');
    return new Response(null, {
      status: 302,
      headers: { Location: url.href, 'Set-Cookie': secureCookie(TRANSACTION_COOKIE, sealed, 300) },
    });
  } catch {
    auditSsoEvent(context, config, 'login_unavailable', 503, config ? 'provider_unavailable' : 'configuration_unavailable');
    return new Response('Authentication service is unavailable.', { status: 503 });
  }
}
