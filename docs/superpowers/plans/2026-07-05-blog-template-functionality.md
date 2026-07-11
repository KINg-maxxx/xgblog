# Blog Template Functionality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local Markdown-based blog template workflow.

**Architecture:** Keep the site static. Generate Markdown post files with a Node script, load them with Vite at build time, and render them with the existing React app.

**Tech Stack:** Node stdlib, React, Vite `import.meta.glob`, existing smoke tests.

---

### Task 1: Tests

**Files:**
- Modify: `package.json`
- Modify: `tests/homepage-smoke.test.mjs`
- Create: `tests/markdown-parser.test.mjs`
- Create: `tests/new-post.test.mjs`

- [ ] Add tests for Markdown posts, parser behavior, and the generator command.
- [ ] Run `npm test`; expected failure is missing blog template files.

### Task 2: Blog Data

**Files:**
- Create: `content/posts/2026-07-05-first-essay.md`
- Create: `src/data/posts.js`
- Create: `src/lib/markdown.js`
- Modify: `src/data/site.js`
- Modify: `src/App.jsx`

- [ ] Move the sample essay into Markdown.
- [ ] Load all posts with `import.meta.glob`.
- [ ] Render the post selected by `?post=<slug>`.

### Task 3: Generator

**Files:**
- Create: `scripts/new-post.mjs`
- Modify: `package.json`

- [ ] Add `npm run new:post -- "文章标题"`.
- [ ] Generate date/category/excerpt frontmatter.
- [ ] Refuse to overwrite an existing post.

### Task 4: Verify

**Files:**
- Modify if needed: `tests/homepage-smoke.test.mjs`

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Browser-check `/blog/index.html` and `/blog/index.html?post=<slug>`.
- [ ] Commit the change.

