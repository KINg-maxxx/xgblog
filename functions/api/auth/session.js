import { readSession } from '../../_shared/oidc-client.js';
import { createCsrfToken } from '../../_shared/csrf.js';
import { getSiteConfig } from '../../_shared/sso-config.js';
import { clearCookie } from '../../_shared/sealed-cookie.js';

const SESSION_COOKIE = '__Host-wxg_session';

export async function onRequest(context) {
  if (context.request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  if (context.env.SSO_ENABLED !== '1' && context.env.SSO_ENABLED !== 'true') {
    return Response.json(
      { authenticated: false, ssoEnabled: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const state = await readSession(context);
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (state.clear) headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  let body = { authenticated: false };
  if (state.authenticated) {
    try {
      const config = getSiteConfig(context.request, context.env);
      body = {
        authenticated: true,
        ssoEnabled: true,
        user: state.user,
        permission: state.permission,
        csrfToken: await createCsrfToken(context.request, config, 'logout'),
      };
    } catch {
      return new Response(JSON.stringify({ authenticated: false }), { status: 503, headers });
    }
  }
  return new Response(JSON.stringify(body), { status: state.status, headers });
}
