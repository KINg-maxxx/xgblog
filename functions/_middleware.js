import { readSession } from './_shared/oidc-client.js';
import { clearCookie } from './_shared/sealed-cookie.js';

const ANNOTATION_HOST = 'annotate.periopact.cn';
const WORKBENCH_PATH = '/tools/annotation-workbench.html';
const WORKBENCH_PATHS = new Set([WORKBENCH_PATH, '/tools/annotation-workbench']);
const SESSION_COOKIE = '__Host-wxg_session';
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/callback',
  '/auth/logout',
  '/api/auth/session',
]);

function ssoEnabled(env) {
  return env.SSO_ENABLED === '1' || env.SSO_ENABLED === 'true';
}

function isWorkbenchPath(pathname) {
  try {
    let decoded = pathname;
    for (let pass = 0; pass < 3; pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    return WORKBENCH_PATHS.has(decoded);
  } catch {
    return false;
  }
}

function nextRequest(context, url) {
  if (!url) return context.next();
  return context.next(new Request(url, context.request));
}

function failure(state) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  if (state.clear) headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  const message = state.status === 403
    ? '当前 PACT 账户未获标注工作台授权。'
    : '身份服务暂不可用，请稍后重试。';
  return new Response(message, { status: state.status, headers });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();
  if (isWorkbenchPath(url.pathname) && host !== ANNOTATION_HOST) {
    return new Response(null, {
      status: 308,
      headers: {
        Location: `https://${ANNOTATION_HOST}/`,
        'Cache-Control': 'no-store',
      },
    });
  }
  if (host !== ANNOTATION_HOST) return context.next();

  const rewritten = url.pathname === '/' || (isWorkbenchPath(url.pathname) && url.pathname !== WORKBENCH_PATH)
    ? new URL(`${WORKBENCH_PATH}${url.search}${url.hash}`, url)
    : null;

  if (!ssoEnabled(context.env)) return nextRequest(context, rewritten);
  if (PUBLIC_AUTH_PATHS.has(url.pathname)) return context.next();

  const state = await readSession(context);
  if (state.authenticated) return nextRequest(context, rewritten);
  if (state.status === 401) {
    const login = new URL('/auth/login', url.origin);
    login.searchParams.set('returnTo', WORKBENCH_PATH);
    const headers = new Headers({ Location: login.href, 'Cache-Control': 'no-store' });
    if (state.clear) headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
    return new Response(null, { status: 302, headers });
  }
  return failure(state);
}
