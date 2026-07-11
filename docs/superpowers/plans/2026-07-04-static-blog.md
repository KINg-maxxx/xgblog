# Static Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static essay blog and public contact details to the personal homepage.

**Architecture:** Keep direct-open static HTML. Extend the existing smoke test, update `index.html`, and add two blog pages under `blog/`.

**Tech Stack:** HTML, CSS, local Anime.js, Node.js built-in smoke test.

---

### Task 1: Smoke Test

**Files:**
- Modify: `tests/homepage-smoke.test.mjs`

- [ ] **Step 1: Add assertions**

Check for `blog/index.html`, `blog/first-essay.html`, homepage `Blog` links, first essay title, and the three contact values.

- [ ] **Step 2: Run red**

Run `node tests/homepage-smoke.test.mjs`.

Expected: failure because blog pages and contact values are not present yet.

### Task 2: Static Pages

**Files:**
- Modify: `index.html`
- Create: `blog/index.html`
- Create: `blog/first-essay.html`

- [ ] **Step 1: Implement**

Add blog nav, homepage preview, blog list page, first article template, and real contact info.

- [ ] **Step 2: Run green**

Run `node tests/homepage-smoke.test.mjs`.

Expected: exit code 0.

### Task 3: Browser Check

**Files:**
- Create ignored screenshots in `output/playwright/`

- [ ] **Step 1: Capture screenshots**

Capture homepage, blog list, and article page with Playwright.

- [ ] **Step 2: Inspect**

Expected: pages render, no obvious overlap, links are visible.
