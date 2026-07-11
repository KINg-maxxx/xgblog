# PACT Cross-Site SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend PACT into the single OpenID Connect identity provider for the blog, annotation workbench, Huozi Yinshua, and PACT View, then deploy and verify one-login access, administrator-assigned app access, and global logout on `*.periopact.cn`.

**Architecture:** PACT keeps its existing host-only `pact_session` and mounts `oidc-provider` at `https://www.periopact.cn/oidc`. Each Cloudflare Pages application is a confidential OIDC client implemented with `openid-client`; it stores a sealed, host-only session cookie and introspects the opaque access token before protected work. PACT app grants are separate from clinical roles and are managed in the existing account administration UI.

**Tech Stack:** TypeScript, Node.js, PostgreSQL/SQLite, `oidc-provider` 9.x, React 18, Cloudflare Pages Functions, `openid-client` 6.x, `jose` 6.x, Vitest, Node test runner, Playwright, Wrangler 4.x.

## Global Constraints

- PACT remains the only password and account source.
- Never expose `pact_session`, client secrets, authorization codes, access tokens, ID tokens, or PKCE verifiers to page JavaScript or logs.
- Use Authorization Code Flow, PKCE `S256`, exact redirect URIs, opaque access tokens, introspection, revocation, and RP-Initiated Logout.
- Do not use a shared `.periopact.cn` credential Cookie; every app Cookie is `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
- App access is independent of clinical roles and is limited to `blog.access`, `annotate.access`, `print.access`, and `view.access` in phase one.
- PACT and every client have independent feature switches; schema changes are additive.
- Public blog content must remain available when PACT is unavailable; protected tools fail closed.
- Keep the existing local blog editor private and outside the SSO deployment.
- Recover Huozi Yinshua and PACT View from their exact production HTML before adding authentication; never edit minified deployment bundles as the long-term source.
- Use tests first for every behavior change and commit each independently reviewable task.

---

### Task 1: Establish Isolated Worktrees and Production Baselines

**Files:**
- Create worktree: `/Users/xking/.codex/worktrees/pact-sso`
- Create worktree: `/Users/xking/.codex/worktrees/xgblog-sso`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/index.html`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/index.html`
- Create: each recovered repository's `PRODUCTION_BASELINE.sha256`

**Interfaces:**
- Consumes: PACT commit `830af808`, xgblog commit containing this plan, production URLs.
- Produces: clean isolated branches `feat/pact-sso` and `feat/xgblog-sso`, exact source snapshots for the two static tools.

- [ ] **Step 1: Create worktrees without touching the user's dirty PACT checkout**

```bash
git -C '/Users/xking/Documents/PACT随访管理平台/PACT' worktree add -b feat/pact-sso /Users/xking/.codex/worktrees/pact-sso 830af808
git -C '/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/wxg-tool-portal-20260705-115015' worktree add -b feat/xgblog-sso /Users/xking/.codex/worktrees/xgblog-sso HEAD
```

Expected: both worktrees report clean status; the original modified `PatientDrawer.tsx` remains untouched.

- [ ] **Step 2: Recover exact production HTML**

```bash
curl -fsSL https://huozi-yinshua.pages.dev/ -o /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/index.html
curl -fsSL https://pactviewbywxg.pages.dev/ -o /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/index.html
shasum -a 256 /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/index.html
shasum -a 256 /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/index.html
```

Expected hashes:

```text
cee967f08c0312919b4d5eabf7d4f7587f21c21068e1fe2ab7cc22fdb98843f2  huozi-yinshua/index.html
014fa738e1a20f8a480689ac1fe3350280062f663ae50f33fa43581ab2ee193c  pact-view/index.html
```

- [ ] **Step 3: Initialize private tool repositories**

Create `.gitignore`, `README.md`, and the baseline hash file with `apply_patch`, then:

```bash
git -C /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua init -b main
git -C /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua add .
git -C /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua commit -m 'chore: recover production source'
gh repo create KINg-maxxx/huozi-yinshua --private --source /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua --remote origin --push

git -C /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view init -b main
git -C /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view add .
git -C /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view commit -m 'chore: recover production source'
gh repo create KINg-maxxx/pact-view --private --source /Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view --remote origin --push
```

Expected: each private GitHub repository has a baseline commit whose `index.html` hash matches production.

---

### Task 2: Add PACT App-Access Schema and Domain Types

**Files:**
- Create: `/Users/xking/.codex/worktrees/pact-sso/db/schema/12_sso.sql`
- Create: `/Users/xking/.codex/worktrees/pact-sso/db/postgres/schema/12_sso.sql`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/apps.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/appAccess.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/appAccess.test.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/shared/types/auth.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/server/api/dataGet.ts`
- Test: `/Users/xking/.codex/worktrees/pact-sso/server/db/schema.test.ts`

**Interfaces:**
- Produces: `APP_CLIENTS`, `AppClientId`, `AppPermission`, `readUserAppAccess(db, userId)`, `replaceUserAppAccess(tx, input)`, `hasUserAppAccess(db, userId, clientId)`.

- [ ] **Step 1: Write failing schema and access tests**

```ts
it('stores app access separately from clinical roles', async () => {
  await db.query('INSERT INTO user_app_access (user_id, client_id, enabled, granted_by, granted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['USER-1', 'wxg-annotate', 1, 'ADMIN-1', now, now]);
  expect(await readUserAppAccess(db, 'USER-1')).toEqual(['annotate.access']);
});

it('rejects unknown clients at the database boundary', async () => {
  await expect(insertAccess('unknown-client')).rejects.toThrow();
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npx vitest run server/sso/appAccess.test.ts server/db/schema.test.ts
```

Expected: FAIL because the table and access module do not exist.

- [ ] **Step 3: Add the registry and additive schema**

```ts
export const APP_CLIENTS = {
  'wxg-blog': { permission: 'blog.access', label: '博客账户功能' },
  'wxg-annotate': { permission: 'annotate.access', label: '标注工作台' },
  'wxg-print': { permission: 'print.access', label: '活字印刷' },
  'wxg-view': { permission: 'view.access', label: 'PACT View' },
} as const;

export type AppClientId = keyof typeof APP_CLIENTS;
export type AppPermission = (typeof APP_CLIENTS)[AppClientId]['permission'];
```

Both dialect schemas create `user_app_access` with `(user_id, client_id)` primary key, a four-value `client_id` check, audit actor/timestamps, and `ON DELETE CASCADE` from users.

- [ ] **Step 4: Expose grants in `AppUser` without exposing them in `AuthSession`**

Add `appAccess?: AppPermission[]` to `AppUser` and `UpdateUserInput`. `readUsers()` joins enabled rows and emits `appAccess`; it must not include another user's app access in OIDC claims.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run server/sso/appAccess.test.ts server/db/schema.test.ts server/api/dataGet.test.ts
git add db/schema/12_sso.sql db/postgres/schema/12_sso.sql server/sso shared/types/auth.ts server/api/dataGet.ts
git commit -m 'feat(auth): add app access grants'
```

Expected: PASS.

---

### Task 3: Add PACT Administrator App-Access API and UI

**Files:**
- Modify: `/Users/xking/.codex/worktrees/pact-sso/server/api/userAdmin.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/server/api/userAdmin.test.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/src/services/AuthService.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/src/app/App.tsx`
- Create: `/Users/xking/.codex/worktrees/pact-sso/src/app/appAccessModel.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/src/app/appAccessModel.test.ts`

**Interfaces:**
- Consumes: Task 2 `AppPermission` and access persistence functions.
- Produces: PATCH `/api/users/:id` support for `appAccess`, `AuthService.adminUpdateUserAccess()`, four UI toggles.

- [ ] **Step 1: Write failing API and model tests**

```ts
it('lets an admin replace app access and audits the change', async () => {
  const response = await patchUser('USER-1', { appAccess: ['annotate.access', 'view.access'] }, adminCookie);
  expect(response.statusCode).toBe(200);
  expect(response.json.user.appAccess).toEqual(['annotate.access', 'view.access']);
  expect(response.json.auditLog.action).toBe('ADMIN_UPDATE_APP_ACCESS');
});

it('rejects an unknown app permission', async () => {
  expect(normalizeAppAccess(['root.everything'])).toEqual({ ok: false, error: 'Invalid app access' });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run server/api/userAdmin.test.ts src/app/appAccessModel.test.ts
```

- [ ] **Step 3: Implement transactional replacement and revocation hook**

`handleUserAdminRequest` accepts optional `appAccess`. When present, it replaces enabled grants in the existing transaction, writes `ADMIN_UPDATE_APP_ACCESS`, and returns removed Client IDs as `revokedClientIds`; Task 6 consumes that exact field when it adds revocation. Role-only PATCH requests retain current behavior.

- [ ] **Step 4: Add the compact UI**

In the existing role modal, add a “分站权限” section using four checkboxes from `APP_ACCESS_OPTIONS`. Save roles, title, and app access in one request. The list row shows compact badges for granted apps without widening the main table beyond the viewport.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run server/api/userAdmin.test.ts src/app/appAccessModel.test.ts src/services/AuthService.test.ts
git add server/api/userAdmin.ts server/api/userAdmin.test.ts src/services/AuthService.ts src/app/App.tsx src/app/appAccessModel.ts src/app/appAccessModel.test.ts
git commit -m 'feat(auth): manage subsite access'
```

---

### Task 4: Persist OIDC Protocol Artifacts in PACT

**Files:**
- Modify: `/Users/xking/.codex/worktrees/pact-sso/db/schema/12_sso.sql`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/db/postgres/schema/12_sso.sql`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/adapter.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/adapter.test.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/package.json`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/package-lock.json`

**Interfaces:**
- Produces: `createOidcAdapter(db): AdapterFactory`, `revokeArtifactsByGrantId()`, `revokeArtifactsByAccountClient()`, `revokeArtifactsByPactSession()`.

- [ ] **Step 1: Add dependencies**

```bash
npm install oidc-provider@^9.9.1
```

- [ ] **Step 2: Write failing adapter contract tests**

Cover `upsert`, `find`, `findByUid`, `findByUserCode`, `consume`, `destroy`, `revokeByGrantId`, expiry, account/client revocation, and PACT-session revocation for SQLite and the repository `Database` abstraction.

```ts
const Adapter = createOidcAdapter(db);
const grant = new Adapter('Grant');
await grant.upsert('GRANT-1', { accountId: 'USER-1', clientId: 'wxg-blog', pactSessionId: 'SESSION-1' }, 60);
expect(await grant.find('GRANT-1')).toMatchObject({ accountId: 'USER-1' });
await revokeArtifactsByPactSession(db, 'SESSION-1');
expect(await grant.find('GRANT-1')).toBeUndefined();
```

- [ ] **Step 3: Verify RED, implement, and verify GREEN**

```bash
npx vitest run server/sso/adapter.test.ts
```

The schema stores `model`, `id_hash`, JSON payload, `grant_id`, `uid`, `user_code`, `account_id`, `client_id`, `pact_session_id`, `expires_at`, and `consumed_at`. Hash external artifact IDs before persistence; never log them.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json db/schema/12_sso.sql db/postgres/schema/12_sso.sql server/sso/adapter.ts server/sso/adapter.test.ts
git commit -m 'feat(auth): persist OIDC artifacts'
```

---

### Task 5: Configure the PACT OpenID Provider

**Files:**
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/config.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/provider.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/provider.test.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/interaction.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/interaction.test.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/audit.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/audit.test.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/server/cloudServer.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/server/cloudServer.test.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/src/features/auth/AuthScreens.tsx`

**Interfaces:**
- Consumes: Tasks 2 and 4.
- Produces: issuer `/oidc`, discovery, authorization, token, introspection, revocation, logout, and interaction routes.

- [ ] **Step 1: Write configuration and route tests**

```ts
it('fails closed when SSO is enabled without all secrets', () => {
  expect(() => readSsoConfig({ PACT_SSO_ENABLED: '1' })).toThrow('PACT_OIDC_COOKIE_KEYS');
});

it('publishes only exact production callbacks', async () => {
  const metadata = await request('/oidc/.well-known/openid-configuration');
  expect(metadata.issuer).toBe('https://www.periopact.cn/oidc');
  expect(providerClients()).toContainEqual(expect.objectContaining({
    client_id: 'wxg-blog',
    redirect_uris: ['https://blog.periopact.cn/auth/callback'],
  }));
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run server/sso/provider.test.ts server/sso/interaction.test.ts server/cloudServer.test.ts
```

- [ ] **Step 3: Configure the provider**

Use `oidc-provider` with the Task 4 adapter, `client_secret_basic`, code flow only, PKCE required, 60-second authorization codes, 8-hour maximum sessions, opaque access tokens, introspection, revocation, RP logout, and static clients from environment secrets. Disable dynamic registration, implicit, password, device, and refresh grants.

- [ ] **Step 4: Bridge existing PACT login**

The interaction handler authenticates `pact_session` through `cookieAuth.authenticate`. If absent, redirect to `/?sso_return_to=<same-origin interaction path>`. After `AuthService.login`, `LoginPage` navigates only to a validated `/oidc/interaction/...` path. If the account is disabled, locked, must change password, or lacks the requested app grant, finish with a safe OIDC error or a branded 403 response.

- [ ] **Step 5: Generate minimal claims and automatic first-party consent**

`findAccount()` returns `sub`, `name`, optional `picture`, `sid`, and the namespaced app-access claim for the current audience. It never returns password fields, department, patient data, full roles, or grants for another client.

- [ ] **Step 6: Add safe protocol audit events**

Map provider success, login-required, access-denied, invalid-request, code replay, token revocation, and logout events to the existing `audit_logs` table plus structured counters. Store trace ID, client ID, user ID when known, status, and reason code; tests assert serialized audit rows never contain code, token, secret, Cookie, password, or clinical data.

- [ ] **Step 7: Mount before static serving, verify, and commit**

```bash
npx vitest run server/sso/provider.test.ts server/sso/interaction.test.ts server/sso/audit.test.ts server/cloudServer.test.ts
git add server/sso server/cloudServer.ts server/cloudServer.test.ts src/features/auth/AuthScreens.tsx
git commit -m 'feat(auth): mount PACT OpenID provider'
```

---

### Task 6: Implement Central Revocation and Global Logout

**Files:**
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/revocation.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/server/sso/revocation.test.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/server/api/logout.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/server/api/logout.test.ts`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/server/api/userAdmin.ts`

**Interfaces:**
- Produces: `revokePactSession(db, sessionId)`, `revokeUserClient(db, userId, clientId)`, `revokeUserEverywhere(db, userId)`.

- [ ] **Step 1: Write failing revocation tests**

Test normal PACT logout, RP-Initiated Logout, one-client access removal, account disable, and unrelated-user isolation. Each test inserts two users, two clients, multiple Grants and AccessTokens, then asserts only the intended tree is destroyed.

- [ ] **Step 2: Verify RED, implement, and verify GREEN**

```bash
npx vitest run server/sso/revocation.test.ts server/api/logout.test.ts server/api/userAdmin.test.ts
```

PACT logout deletes the main session and every artifact linked through `pact_session_id`. Access removal revokes only that user's client artifacts. Account disable revokes every app artifact and PACT session for that user.

- [ ] **Step 3: Commit**

```bash
git add server/sso/revocation.ts server/sso/revocation.test.ts server/api/logout.ts server/api/logout.test.ts server/api/userAdmin.ts server/api/userAdmin.test.ts
git commit -m 'feat(auth): revoke cross-site sessions globally'
```

---

### Task 7: Add PACT Deployment Configuration and Full Verification

**Files:**
- Modify: `/Users/xking/.codex/worktrees/pact-sso/scripts/cloud/bootstrap.sh`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/scripts/cloud/deploy-cloud.ps1`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/scripts/cloud/README.md`
- Create: `/Users/xking/.codex/worktrees/pact-sso/.env.sso.example`

**Interfaces:**
- Consumes: Tasks 2 through 6.
- Produces: persisted production variables and an opt-in deployment path.

- [ ] **Step 1: Add source-text tests for required environment persistence**

Verify bootstrap writes `PACT_SSO_ENABLED`, `PACT_OIDC_ISSUER`, `PACT_OIDC_COOKIE_KEYS`, and four client secrets to `/etc/pact/pact-cloud.env`, with mode `600`, without printing secret values.

- [ ] **Step 2: Add feature-safe deployment plumbing**

Defaults keep `PACT_SSO_ENABLED=0`. Deployment preserves existing secret values when local overrides are absent. README documents secret generation with `openssl rand -base64 48` and describes two-key cookie rotation.

- [ ] **Step 3: Run PACT verification**

```bash
npm test -- --run server/sso server/api/userAdmin.test.ts server/api/logout.test.ts server/cloudServer.test.ts
npm run build:cloud
```

Expected: all focused tests and cloud build pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/cloud .env.sso.example
git commit -m 'chore(auth): configure SSO deployment'
```

---

### Task 8: Build the Cloudflare OIDC Client in xgblog

**Files:**
- Modify: `/Users/xking/.codex/worktrees/xgblog-sso/package.json`
- Modify: `/Users/xking/.codex/worktrees/xgblog-sso/package-lock.json`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/functions/_shared/sso-config.js`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/functions/_shared/sealed-cookie.js`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/functions/_shared/oidc-client.js`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/functions/auth/login.js`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/functions/auth/callback.js`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/functions/auth/logout.js`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/functions/api/auth/session.js`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/tests/sso-client.test.mjs`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/tests/sso-routes.test.mjs`

**Interfaces:**
- Produces: `getSiteConfig(request, env)`, `sealCookie(payload, key)`, `unsealCookie(value, key)`, `readSession(context)`, and the four auth routes.

- [ ] **Step 1: Install standards libraries and write failing tests**

```bash
npm install openid-client@^6.8.4 jose@^6.2.3
```

Tests cover host-to-client mapping, exact return paths, JWE tamper rejection, transaction expiry, state/nonce/PKCE mismatch, issuer outage, Cookie attributes, token introspection, and removal of code parameters from the final URL.
They also capture structured log calls and prove no code, token, ID token, client secret, Cookie, or PKCE verifier is emitted.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/sso-client.test.mjs tests/sso-routes.test.mjs
```

- [ ] **Step 3: Implement confidential-client routes**

`/auth/login` creates state, nonce, and PKCE verifier, seals them in a five-minute `__Host-wxg_sso_tx` Cookie, and redirects to PACT. `/auth/callback` validates the transaction with `openid-client`, exchanges the code server-side, seals the token set in `__Host-wxg_session`, clears the transaction, and redirects to the validated relative return path. `/api/auth/session` introspects every request and returns only `{ authenticated, user: { id, name, picture }, permission }`.

- [ ] **Step 4: Implement global logout**

`/auth/logout` clears both local cookies and redirects to the provider's end-session endpoint with an exact post-logout URI. Tokens and ID tokens stay inside sealed HttpOnly cookies and server-side redirects.

- [ ] **Step 5: Verify and commit**

```bash
node --test tests/sso-client.test.mjs tests/sso-routes.test.mjs
git add package.json package-lock.json functions tests/sso-client.test.mjs tests/sso-routes.test.mjs
git commit -m 'feat(auth): add Cloudflare OIDC client'
```

---

### Task 9: Protect Annotation and Add Blog Identity UI

**Files:**
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/functions/_middleware.js`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/src/AuthStatus.jsx`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/src/auth.js`
- Modify: `/Users/xking/.codex/worktrees/xgblog-sso/src/App.jsx`
- Modify: `/Users/xking/.codex/worktrees/xgblog-sso/src/styles.css`
- Modify: `/Users/xking/.codex/worktrees/xgblog-sso/tests/homepage-smoke.test.mjs`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/tests/sso-middleware.test.mjs`
- Create: `/Users/xking/.codex/worktrees/xgblog-sso/.dev.vars.example`

**Interfaces:**
- Consumes: Task 8.
- Produces: public blog identity chip, `annotate.access` edge gate, host-based annotation rewrite, and Pages feature switch.

- [ ] **Step 1: Write failing middleware and UI tests**

Test that blog pages call `context.next()` anonymously, `annotate.periopact.cn` redirects unauthenticated users to `/auth/login`, authorized requests rewrite `/` to `/tools/annotation-workbench.html`, and disabled SSO preserves the previous public behavior. Source tests assert the account chip has loading, anonymous, authenticated, denied, and unavailable states.

- [ ] **Step 2: Verify RED**

```bash
npm test
node --test tests/sso-middleware.test.mjs
```

- [ ] **Step 3: Implement edge protection and identity UI**

The middleware never gates blog articles. Annotation requires live introspection at entry and on `/api/auth/session`; the inline workbench adds a 60-second heartbeat and `visibilitychange` check, locking the UI when authentication expires. The nav chip displays the PACT display name and provides login/global logout commands without changing layout dimensions.
OIDC callback parameters are removed before the React app and Google Analytics initialize, so a successful callback produces only the clean destination page view.

- [ ] **Step 4: Add CSRF checks for state-changing Functions**

Create a shared same-origin guard and apply it to logout and future protected writes. Require `Origin` or `Referer` host equality plus a transaction-bound CSRF value; never rely only on `SameSite`.

- [ ] **Step 5: Verify build and commit**

```bash
npm test
npm run build
git add functions src tests .dev.vars.example
git commit -m 'feat(auth): protect annotation with PACT SSO'
```

---

### Task 10: Make Huozi Yinshua Reproducible and Add SSO

**Files:**
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/package.json`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/package-lock.json`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/scripts/build.mjs`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/functions/_shared/sso-config.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/functions/_shared/sealed-cookie.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/functions/_shared/oidc-client.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/functions/_shared/csrf.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/functions/auth/login.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/functions/auth/callback.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/functions/auth/logout.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/functions/api/auth/session.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/functions/_middleware.js`
- Modify: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/index.html`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/tests/baseline.test.mjs`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/tests/sso-client.test.mjs`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/tests/sso-routes.test.mjs`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/huozi-yinshua/tests/sso-middleware.test.mjs`

**Interfaces:**
- Produces: exact static build plus `wxg-print` OIDC client and `print.access` gate.

- [ ] **Step 1: Write baseline and auth tests**

The baseline test verifies the recovered title, editor, theme controls, export handlers, and five CDN dependencies. Auth tests assert `client_id=wxg-print`, `permission=print.access`, exact `print.periopact.cn` callbacks, sealed-Cookie tamper rejection, transaction expiry, state/nonce/PKCE mismatch rejection, opaque-token introspection, issuer outage behavior, host-only Cookie attributes, and global logout redirection.

- [ ] **Step 2: Verify RED, add build, then verify the unauthenticated build preserves the baseline**

```bash
npm test
npm run build
```

The build script recreates `dist/` and copies `index.html`; it does not minify or rewrite the recovered source.

- [ ] **Step 3: Add auth routes and protected middleware**

Implement `getSiteConfig`, `sealCookie`, `unsealCookie`, `readSession`, `/auth/login`, `/auth/callback`, `/auth/logout`, and `/api/auth/session` for the single `print.periopact.cn` host. The login route creates state, nonce, and PKCE; the callback exchanges server-side; the session route introspects; all cookies use the required `__Host-` attributes. Add a compact PACT account control to the existing top bar and a 60-second/visibility heartbeat without changing the editor or export logic.

- [ ] **Step 4: Verify and commit**

```bash
npm test
npm run build
git add .
git commit -m 'feat: protect Huozi with PACT SSO'
git push
```

---

### Task 11: Make PACT View Reproducible and Add SSO

**Files:**
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/package.json`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/package-lock.json`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/scripts/build.mjs`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/functions/_shared/sso-config.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/functions/_shared/sealed-cookie.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/functions/_shared/oidc-client.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/functions/_shared/csrf.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/functions/auth/login.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/functions/auth/callback.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/functions/auth/logout.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/functions/api/auth/session.js`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/functions/_middleware.js`
- Modify: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/index.html`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/tests/baseline.test.mjs`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/tests/sso-client.test.mjs`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/tests/sso-routes.test.mjs`
- Create: `/Users/xking/Syncthing/Mac-Windows-Sync/成果/个人网站/pact-view/tests/sso-middleware.test.mjs`

**Interfaces:**
- Produces: exact viewer build plus `wxg-view` OIDC client and `view.access` gate.

- [ ] **Step 1: Write baseline tests**

Assert the import map pins Three.js `0.164.1`, the four loaders remain, all CBCT/PLY input controls remain, the three MPR canvases render, and the WebGL canvas setup is unchanged.

- [ ] **Step 2: Add the reproducible build and auth tests**

Write tests for `client_id=wxg-view`, `permission=view.access`, the exact `view.periopact.cn` callback, sealed-Cookie tamper rejection, transaction expiry, state/nonce/PKCE mismatch rejection, opaque-token introspection, issuer outage behavior, host-only Cookie attributes, and global logout. Run `npm test` and verify RED before implementation.

- [ ] **Step 3: Add protected middleware and account state**

Implement `getSiteConfig`, `sealCookie`, `unsealCookie`, `readSession`, `/auth/login`, `/auth/callback`, `/auth/logout`, and `/api/auth/session` for the single `view.periopact.cn` host. Add a compact account control within the existing control panel. Authentication state must not resize or cover the WebGL canvas, MPR panels, file inputs, or mobile controls. Heartbeat failure locks file loading and clears loaded patient data from the UI state.

- [ ] **Step 4: Verify rendering and commit**

```bash
npm test
npm run build
```

Use Playwright screenshots at 1440x900 and 390x844 plus canvas pixel checks to prove the WebGL canvas is nonblank and controls do not overlap. Then commit and push:

```bash
git add .
git commit -m 'feat: protect PACT View with PACT SSO'
git push
```

---

### Task 12: Run Local Cross-Site End-to-End Tests

**Files:**
- Create: `/Users/xking/.codex/worktrees/pact-sso/tests/e2e/sso-cross-site.spec.ts`
- Create: `/Users/xking/.codex/worktrees/pact-sso/scripts/sso-local-proxy.mjs`
- Modify: `/Users/xking/.codex/worktrees/pact-sso/playwright.config.ts`

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: repeatable browser proof before production changes.

- [ ] **Step 1: Add local host routing**

Run PACT, xgblog Pages, Huozi Pages, and PACT View Pages on separate loopback ports, fronted by a local proxy that maps `www.periopact.localhost`, `blog.periopact.localhost`, `annotate.periopact.localhost`, `print.periopact.localhost`, and `view.periopact.localhost`. Use test-only exact callbacks and non-Secure Cookies only when `NODE_ENV !== production`.

- [ ] **Step 2: Write the full E2E matrix**

Tests cover one PACT login followed by passwordless access to all four clients, anonymous blog access, per-app denial, app grant addition, app grant removal, account disable, global logout from every client, callback replay, wrong state, wrong PKCE, and PACT outage.

- [ ] **Step 3: Run and capture evidence**

```bash
npm run test:e2e -- tests/e2e/sso-cross-site.spec.ts
```

Expected: all scenarios pass in Chromium and WebKit. Save screenshots and traces only on failure.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/sso-cross-site.spec.ts scripts/sso-local-proxy.mjs playwright.config.ts
git commit -m 'test(auth): cover cross-site SSO flow'
```

---

### Task 13: Review, Merge, and Push Source Changes

**Files:** all changed repositories.

- [ ] **Step 1: Run complete verification in every repository**

```bash
npm test && npm run build:cloud   # PACT
npm test && npm run build         # xgblog
npm test && npm run build         # Huozi
npm test && npm run build         # PACT View
```

- [ ] **Step 2: Perform correctness and security review**

Review changed files for secret leakage, open redirects, Cookie scope, missing introspection, CSRF gaps, token logging, fail-open behavior, and clinical-data claims. Resolve every P0/P1/P2 finding before merge.

- [ ] **Step 3: Merge without overwriting user changes**

Push `feat/pact-sso` and open a GitHub pull request targeting `feat/annotation-workbench-embed`. Merge the pull request remotely after checks pass; do not modify, stash, or overwrite the user's dirty original checkout or `PatientDrawer.tsx`. Merge `feat/xgblog-sso` into xgblog `main`. Push all four repositories only after clean status and green verification.

---

### Task 14: Configure Secrets, Domains, and Production Deployments

**Files:** Cloudflare Pages settings, PACT `/etc/pact/pact-cloud.env`, DNS records.

- [ ] **Step 1: Generate distinct production secrets**

Generate PACT cookie keys, four client secrets, and one 32-byte JWE Cookie key per Cloudflare project. Store only in the destination secret stores. Never print them in the final report.

- [ ] **Step 2: Configure Cloudflare Pages secrets**

Use `wrangler pages secret put` for `OIDC_ISSUER`, client ID/secret, Cookie key, post-logout URI, and `SSO_ENABLED=0` in `xgblog`, `huozi-yinshua`, and `pactviewbywxg`. xgblog receives separate blog and annotation client secrets selected by host.

- [ ] **Step 3: Deploy PACT disabled, migrate, and smoke-test**

Deploy the PACT build with `PACT_SSO_ENABLED=0`, verify schema creation and all existing clinical health checks, then set `PACT_SSO_ENABLED=1` and verify discovery, authorization, token, introspection, revocation, and logout over HTTPS.

- [ ] **Step 4: Bind custom domains**

Bind:

```text
blog.periopact.cn     -> xgblog
annotate.periopact.cn -> xgblog
print.periopact.cn    -> huozi-yinshua
view.periopact.cn     -> pactviewbywxg
```

Wait for Cloudflare certificates to become active and verify exact DNS, TLS, and HTTP status before enabling clients.

- [ ] **Step 5: Deploy clients disabled, then enable in order**

Deploy xgblog, Huozi, and PACT View with SSO disabled. Enable blog/annotation first, verify, then print, then view. Grant the test account through the PACT administrator UI before each client check.

- [ ] **Step 6: Enable `pages.dev` redirects only after acceptance**

Use host-aware redirects to each production custom domain. Preserve path and query, except remove OIDC callback parameters after callback processing.

---

### Task 15: Production Acceptance and Completion Audit

**Files:** live services and audit evidence.

- [ ] **Step 1: Verify one-login behavior**

In a fresh browser profile, log in once at PACT, then open all four custom domains. Confirm no password prompt, exact user name, correct permission, host-only Cookies, and no secrets in network payloads or built JavaScript.

- [ ] **Step 2: Verify denial and revocation**

Remove each app grant in PACT and prove the next protected request returns `403`; prove loaded static tools lock within 60 seconds. Disable the account and prove all clients reject it.

- [ ] **Step 3: Verify global logout from every client**

For each client, log in once, open all clients, log out from that client, and prove PACT plus every other client requires a new PACT login.

- [ ] **Step 4: Verify failure isolation and regressions**

Temporarily disable the PACT identity endpoint and prove blog articles stay available while tools fail closed. Re-enable it and verify PACT clinical workflows, comments, analytics, Huozi export, annotation export, and PACT View WebGL/MPR rendering.

- [ ] **Step 5: Verify source and deployment state**

Confirm all repositories are clean and pushed, GitHub heads equal deployed commit metadata, Cloudflare assets match local build hashes, custom domains serve the expected projects, and no untracked `.wrangler` artifacts remain.

- [ ] **Step 6: Record completion**

Only after every acceptance item has direct evidence, update the active goal to complete and report production URLs, commit IDs, test commands, deployment IDs, and any deliberately retained operational limits.
