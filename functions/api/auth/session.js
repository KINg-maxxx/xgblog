import { readSession } from '../../_shared/oidc-client.js';
import { clearCookie } from '../../_shared/sealed-cookie.js';

const SESSION_COOKIE = '__Host-wxg_session';

export async function onRequest(context) {
  if (context.request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  const state = await readSession(context);
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (state.clear) headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  return new Response(JSON.stringify(
    state.authenticated
      ? { authenticated: true, user: state.user, permission: state.permission }
      : { authenticated: false },
  ), { status: state.status, headers });
}
