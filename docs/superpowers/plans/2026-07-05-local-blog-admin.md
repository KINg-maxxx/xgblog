# Local Blog Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a localhost-only visual admin for Markdown blog posts.

**Architecture:** Use a tiny Node HTTP server with JSON endpoints and static admin assets. Reuse the current Markdown/frontmatter format and keep all writes inside `content/posts`.

**Tech Stack:** Node stdlib, browser HTML/CSS/JS, existing Markdown files, existing tests.

---

### Task 1: Tests

**Files:**
- Modify: `package.json`
- Modify: `tests/homepage-smoke.test.mjs`
- Create: `tests/admin-server.test.mjs`

- [ ] Require `npm run admin`, `scripts/admin-server.mjs`, and admin assets.
- [ ] Test list/save/delete helpers against a temp `content/posts`.
- [ ] Run `npm test`; expected failure is missing admin files.

### Task 2: Server

**Files:**
- Create: `scripts/admin-server.mjs`

- [ ] Add helpers for safe post paths, listing posts, reading a post, saving a post, and deleting a post.
- [ ] Add API endpoints for `/api/posts`, `/api/posts/:slug`, and `/api/posts/:slug` delete.
- [ ] Serve admin static files from `admin/`.

### Task 3: Admin Page

**Files:**
- Create: `admin/index.html`
- Create: `admin/admin.css`
- Create: `admin/admin.js`

- [ ] Render the existing article list.
- [ ] Provide title, date, category, excerpt, and body fields.
- [ ] Add live preview, save, new, and delete actions.

### Task 4: Verify

**Files:**
- Modify if needed: tests.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start `npm run admin` and browser-check the admin page.
- [ ] Commit the change.

