import * as standardOidc from 'openid-client';

import { getSiteConfig } from './sso-config.js';
import { readCookie, unsealCookie } from './sealed-cookie.js';

const SESSION_COOKIE = '__Host-wxg_session';
const APP_ACCESS_CLAIM = 'https://periopact.cn/claims/app_access';

function adapterFor(context) {
  return context.data?.oidc || standardOidc;
}

async function discover(config, oidc) {
  const auth = oidc.ClientSecretBasic ? oidc.ClientSecretBasic(config.clientSecret) : undefined;
  return oidc.discovery(new URL(config.issuer), config.clientId, {
    redirect_uris: [config.callbackUri],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
  }, auth);
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
  const tokens = await oidc.authorizationCodeGrant(configuration, new URL(request.url), {
    expectedState: transaction.state,
    expectedNonce: transaction.nonce,
    pkceCodeVerifier: transaction.verifier,
  });
  if (!tokens.access_token || !tokens.id_token) throw new Error('Incomplete token response');
  const expiresIn = Number(tokens.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error('Invalid token expiry');
  return {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    expiresAt: Date.now() + Math.min(Math.floor(expiresIn), 8 * 60 * 60) * 1000,
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
    return { authenticated: false, status: 401, clear: true };
  }

  try {
    const details = await adapterFor(context).tokenIntrospection(await discover(config, adapterFor(context)), stored.accessToken);
    if (!details.active || !details.sub) return { authenticated: false, status: 401, clear: true };
    if (!hasPermission(details[APP_ACCESS_CLAIM], config.permission)) {
      return { authenticated: false, status: 403, clear: true };
    }
    return {
      authenticated: true,
      status: 200,
      user: { id: details.sub, name: details.name || null, picture: details.picture || null },
      permission: config.permission,
    };
  } catch {
    return { authenticated: false, status: 503, unavailable: true };
  }
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
