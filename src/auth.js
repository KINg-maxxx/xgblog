const CALLBACK_PARAMETERS = [
  'code',
  'state',
  'session_state',
  'iss',
  'error',
  'error_description',
  'error_uri',
];

export async function fetchAuthState(fetchImpl = fetch) {
  try {
    const response = await fetchImpl('/api/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json();
    if (response.status === 200 && body.ssoEnabled === false) return { state: 'disabled' };
    if (response.status === 200
      && body.authenticated === true
      && body.user?.id
      && typeof body.csrfToken === 'string'
      && body.csrfToken) {
      return { state: 'authenticated', user: body.user, csrfToken: body.csrfToken };
    }
    if (response.status === 401) return { state: 'anonymous' };
    if (response.status === 403) return { state: 'denied' };
    return { state: 'unavailable' };
  } catch {
    return { state: 'unavailable' };
  }
}

export function getLoginHref(location = window.location) {
  const returnTo = location.pathname.startsWith('/blog/') ? '/blog/' : '/';
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function submitGlobalLogout(csrfToken, documentRef = document) {
  if (!csrfToken) throw new Error('Missing logout token');
  const form = documentRef.createElement('form');
  const input = documentRef.createElement('input');
  form.method = 'post';
  form.action = '/auth/logout';
  form.hidden = true;
  input.type = 'hidden';
  input.name = 'csrfToken';
  input.value = csrfToken;
  form.appendChild(input);
  documentRef.body.appendChild(form);
  form.submit();
}

export function cleanOidcCallbackParameters(
  location = window.location,
  history = window.history,
) {
  const url = new URL(location.href);
  const isCallback = url.searchParams.has('state')
    && (url.searchParams.has('code') || url.searchParams.has('error'));
  if (!isCallback) return false;
  CALLBACK_PARAMETERS.forEach(parameter => url.searchParams.delete(parameter));
  history.replaceState(history.state ?? null, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}
