import { beginAuthorization, oidcFor } from '../_shared/oidc-client.js';
import { getSiteConfig, validateReturnTo } from '../_shared/sso-config.js';
import { sealCookie, secureCookie } from '../_shared/sealed-cookie.js';

const TRANSACTION_COOKIE = '__Host-wxg_sso_tx';

function audit(context, event) {
  const entry = { component: 'sso', event };
  if (typeof context.data?.log === 'function') context.data.log(entry);
  else console.warn(JSON.stringify(entry));
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  try {
    const config = getSiteConfig(context.request, context.env);
    const returnTo = validateReturnTo(new URL(context.request.url).searchParams.get('returnTo'), config);
    const { transaction, url } = await beginAuthorization(config, returnTo, oidcFor(context));
    const sealed = await sealCookie(transaction, config.cookieKey);
    audit(context, 'login_started');
    return new Response(null, {
      status: 302,
      headers: { Location: url.href, 'Set-Cookie': secureCookie(TRANSACTION_COOKIE, sealed, 300) },
    });
  } catch {
    audit(context, 'login_unavailable');
    return new Response('Authentication service is unavailable.', { status: 503 });
  }
}
