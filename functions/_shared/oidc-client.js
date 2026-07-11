import * as standardOidc from 'openid-client';

import { auditSsoEvent } from './sso-audit.js';
import { getSiteConfig, PACT_SSO_EXPIRES_AT_CLAIM } from './sso-config.js';
import { readCookie, unsealCookie } from './sealed-cookie.js';

const SESSION_COOKIE = '__Host-wxg_session';
const APP_ACCESS_CLAIM = 'https://periopact.cn/claims/app_access';

export class OidcCallbackRejectedError extends Error {
  constructor(reason = 'invalid_callback') {
    super(reason);
    this.reason = reason;
  }
}

export class OidcProviderUnavailableError extends Error {
  constructor(reason = 'provider_unavailable') {
    super(reason);
    this.reason = reason;
  }
}

function adapterFor(context) {
  return context.data?.oidc || standardOidc;
}

async function discover(config, oidc) {
  const auth = oidc.ClientSecretBasic ? oidc.ClientSecretBasic(config.clientSecret) : undefined;
  try {
    return await oidc.discovery(new URL(config.issuer), config.clientId, {
      redirect_uris: [config.callbackUri],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    }, auth);
  } catch {
    throw new OidcProviderUnavailableError();
  }
}

function absolutePactExpiry(response) {
  const seconds = response?.[PACT_SSO_EXPIRES_AT_CLAIM];
  if (typeof seconds !== 'number' || !Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new OidcProviderUnavailableError('invalid_expiry_evidence');
  }
  const expiresAt = seconds * 1000;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    throw new OidcProviderUnavailableError('invalid_expiry_evidence');
  }
  return expiresAt;
}

function isRejectedCallbackError(error) {
  return error?.name === 'AuthorizationResponseError'
    || (error?.name === 'ResponseBodyError' && error.status >= 400 && error.status < 500);
}

export function isOidcProviderUnavailable(error) {
  return error instanceof OidcProviderUnavailableError;
}

export async function beginAuthorization(config, returnTo, oidc) {
  const verifier = oidc.randomPKCECodeVerifier();
  const transaction = {
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    verifier,
    returnTo,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  const configuration = await discover(config, oidc);
  const url = oidc.buildAuthorizationUrl(configuration, {
    client_id: config.clientId,
    redirect_uri: config.callbackUri,
    response_type: 'code',
    scope: 'openid profile',
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
  });
  return { transaction, url };
}

export async function completeAuthorization(config, request, transaction, oidc) {
  const configuration = await discover(config, oidc);
  let tokens;
  try {
    tokens = await oidc.authorizationCodeGrant(configuration, new URL(request.url), {
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      pkceCodeVerifier: transaction.verifier,
    });
  } catch (error) {
    if (isRejectedCallbackError(error)) throw new OidcCallbackRejectedError();
    throw new OidcProviderUnavailableError();
  }
  if (!tokens.access_token || !tokens.id_token) throw new OidcProviderUnavailableError('invalid_token_response');
  const expiresAt = absolutePactExpiry(tokens);
  return {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    expiresAt,
  };
}

function hasPermission(value, permission) {
  return Array.isArray(value) ? value.includes(permission) : value === permission;
}

export async function readSession(context) {
  let config;
  try {
    config = getSiteConfig(context.request, context.env);
  } catch {
    return { authenticated: false, status: 503, unavailable: true };
  }

  const sealed = readCookie(context.request, SESSION_COOKIE);
  if (!sealed) return { authenticated: false, status: 401 };

  let stored;
  try {
    stored = await unsealCookie(sealed, config.cookieKey);
  } catch {
    return { authenticated: false, status: 401, clear: true };
  }
  if (!stored.accessToken || !stored.idToken || !Number.isFinite(stored.expiresAt) || stored.expiresAt <= Date.now()) {
    auditSsoEvent(context, config, 'session_inactive', 401, 'local_session_expired');
    return { authenticated: false, status: 401, clear: true };
  }

  let details;
  try {
    details = await adapterFor(context).tokenIntrospection(await discover(config, adapterFor(context)), stored.accessToken);
  } catch (error) {
    auditSsoEvent(context, config, 'introspection_unavailable', 503, error.reason || 'provider_unavailable');
    return { authenticated: false, status: 503, unavailable: true };
  }
  if (!details.active || !details.sub) {
    auditSsoEvent(context, config, 'session_inactive', 401, 'inactive_token');
    return { authenticated: false, status: 401, clear: true };
  }

  let providerExpiresAt;
  try {
    providerExpiresAt = absolutePactExpiry(details);
  } catch (error) {
    auditSsoEvent(context, config, 'introspection_unavailable', 503, error.reason || 'provider_unavailable');
    return { authenticated: false, status: 503, unavailable: true };
  }
  if (stored.expiresAt > providerExpiresAt) {
    auditSsoEvent(context, config, 'session_inactive', 401, 'expiry_bound_changed');
    return { authenticated: false, status: 401, clear: true };
  }
  if (!hasPermission(details[APP_ACCESS_CLAIM], config.permission)) {
    auditSsoEvent(context, config, 'session_denied', 403, 'permission_denied');
    return { authenticated: false, status: 403, clear: true };
  }
  return {
    authenticated: true,
    status: 200,
    user: { id: details.sub, name: details.name || null, picture: details.picture || null },
    permission: config.permission,
  };
}

export async function endSession(config, idToken, oidc) {
  const configuration = await discover(config, oidc);
  return oidc.buildEndSessionUrl(configuration, {
    ...(idToken ? { id_token_hint: idToken } : {}),
    post_logout_redirect_uri: config.postLogoutUri,
  });
}

export function currentSessionCookie(request) {
  return readCookie(request, SESSION_COOKIE);
}

export function oidcFor(context) {
  return adapterFor(context);
}
