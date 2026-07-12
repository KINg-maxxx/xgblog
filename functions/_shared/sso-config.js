const SITES = {
  'blog.periopact.cn': {
    clientId: 'wxg-blog',
    permission: 'blog.access',
    callbackUri: 'https://blog.periopact.cn/auth/callback',
    postLogoutUri: 'https://blog.periopact.cn/',
    defaultReturnTo: '/',
    returnPaths: ['/', '/blog/', '/tools/annotation-workbench'],
    secretName: 'BLOG_OIDC_CLIENT_SECRET',
  },
  'annotate.periopact.cn': {
    clientId: 'wxg-annotate',
    permission: 'annotate.access',
    callbackUri: 'https://annotate.periopact.cn/auth/callback',
    postLogoutUri: 'https://annotate.periopact.cn/',
    defaultReturnTo: '/tools/annotation-workbench',
    returnPaths: ['/', '/tools/annotation-workbench'],
    secretName: 'ANNOTATE_OIDC_CLIENT_SECRET',
  },
};
const EXPECTED_OIDC_ISSUER = 'https://www.periopact.cn/oidc';

// PACT MUST return this numeric Unix-seconds value in both its token response and
// RFC 7662 introspection response. It is the earlier of the PACT session and OIDC grant expiry.
export const PACT_SSO_EXPIRES_AT_CLAIM = 'https://periopact.cn/claims/sso_expires_at';

export function getSiteConfig(request, env) {
  const host = new URL(request.url).hostname.toLowerCase();
  const site = SITES[host];
  if (!site) throw new Error('Unsupported SSO host');

  const issuer = env.OIDC_ISSUER;
  const clientSecret = env[site.secretName];
  const cookieKey = env.OIDC_COOKIE_KEY;
  if (!issuer || !clientSecret || !cookieKey) throw new Error('SSO is not configured');
  if (issuer !== EXPECTED_OIDC_ISSUER) {
    throw new Error(`OIDC issuer must be exactly ${EXPECTED_OIDC_ISSUER}`);
  }

  return { ...site, issuer, clientSecret, cookieKey, origin: `https://${host}` };
}

export function validateReturnTo(value, config) {
  return config.returnPaths.includes(value) ? value : config.defaultReturnTo;
}
