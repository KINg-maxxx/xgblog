# Colleague Tool Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the site as a colleague-facing animated tool portal with React Bits-style components and local Anime.js 4.4.1.

**Architecture:** Convert the single static HTML page into a small React/Vite static app. Store site entries, posts, and contact details in data files; keep copied animation pieces local and use Anime.js for scroll choreography.

**Tech Stack:** React, Vite, local React Bits component code, local Anime.js 4.4.1, Node smoke tests, Playwright browser check.

---

### Task 1: Smoke Test

**Files:**
- Modify: `tests/homepage-smoke.test.mjs`

- [ ] Write the failing test for the new React/Vite shape.
- [ ] Run `node tests/homepage-smoke.test.mjs` and confirm it fails because `package.json`, `src/`, and React Bits files do not exist yet.

### Task 2: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/styles.css`
- Create: `src/data/site.js`
- Create: `src/lib/anime.esm.min.js`
- Create: `src/react-bits/`
- Modify: `index.html`

- [ ] Add minimal Vite scripts and dependencies.
- [ ] Copy Anime.js from `C:\Users\21319\Desktop\05_软件工具与插件\anime-4.4.1\dist\bundles\anime.esm.min.js`.
- [ ] Add only the React Bits components used by this site.

### Task 3: Portal UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/data/site.js`

- [ ] Implement the hero text: `WXG 工具入口` and `请大家在此寻找对应网站及工具`.
- [ ] Render four website cards with screenshots, descriptions, audience hints, and external links.
- [ ] Render `使用说明 / 随笔记录` and contact information.
- [ ] Use React Bits components for visible animated text, cards, and background.
- [ ] Use Anime.js for staggered scroll reveals and section/nav motion.

### Task 4: Blog Compatibility

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/data/site.js`

- [ ] Keep `/blog/` and `/blog/first-essay.html` useful through hash/path detection or static fallback.
- [ ] Preserve links from the homepage to the blog and first essay.

### Task 5: Verify

**Files:**
- Modify if needed: `tests/homepage-smoke.test.mjs`

- [ ] Run `npm install`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start Vite locally and check desktop/mobile screenshots with Playwright.
- [ ] Commit the finished change.

