# Local Blog Admin Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click publishing from the local blog admin to the Cloudflare Pages project `xgblog`.

**Architecture:** Keep the editor local. The browser calls a localhost API, and the Node admin server runs `npm run deploy`, which builds the static site and uploads `dist` with Wrangler.

**Tech Stack:** Node stdlib, existing npm scripts, Cloudflare Wrangler via `npx`, existing browser admin.

---

### Task 1: Pin the Publish Contract

**Files:**
- Modify: `tests/admin-server.test.mjs`
- Modify: `tests/homepage-smoke.test.mjs`

- [x] Add a test that `publishSite()` shells out to `npm run deploy` in the project root.
- [x] Add smoke checks for the deploy script, the admin publish button, and the `/api/publish` browser call.
- [x] Run `npm test`; expected failure is missing `packageJson.scripts.deploy`.

### Task 2: Add the Publish Path

**Files:**
- Modify: `package.json`
- Modify: `scripts/admin-server.mjs`
- Modify: `admin/index.html`
- Modify: `admin/admin.css`
- Modify: `admin/admin.js`

- [x] Add `npm run deploy` using `npm run build && npx --yes wrangler pages deploy dist --project-name xgblog --branch main --commit-dirty=true`.
- [x] Add `publishSite()` and `POST /api/publish` to the admin server.
- [x] Add a “保存并发布” button that saves the current post, then calls `/api/publish`.
- [x] Keep publish status visible in the existing status line.

### Task 3: Verify

**Files:**
- Modify if needed: tests.

- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `npm run deploy`.
- [x] Verify `https://xgblog.pages.dev/` returns the updated site.
