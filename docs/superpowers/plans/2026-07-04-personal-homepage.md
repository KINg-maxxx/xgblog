# Personal Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved static personal homepage with Anime.js motion and four screenshot website cards.

**Architecture:** Keep the site as direct-open static files: one `index.html`, local assets, and one Node smoke test. The page owns its CSS and tiny inline script because there is no build step and no shared frontend system.

**Tech Stack:** HTML, CSS, Anime.js 4.4.1 UMD bundle, Node.js built-in `assert`/`fs`, Playwright CLI for visual verification.

---

### Task 1: Homepage Smoke Test

**Files:**
- Create: `tests/homepage-smoke.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.join(root, 'index.html');

assert.ok(existsSync(htmlPath), 'index.html should exist');

const html = readFileSync(htmlPath, 'utf8');

for (const text of ['我做的网站', 'PerioPACT 主站', '活字印刷', 'PACT View', 'PerioPACT 移动端']) {
  assert.ok(html.includes(text), `index.html should include ${text}`);
}

for (const url of [
  'https://www.periopact.cn/',
  'https://huozi-yinshua.pages.dev/',
  'https://pactviewbywxg.pages.dev/',
  'https://www.periopact.cn/m',
]) {
  assert.ok(html.includes(`href="${url}"`), `index.html should link to ${url}`);
}

for (const asset of [
  'assets/anime.umd.min.js',
  'assets/site-shots/periopact-main.png',
  'assets/site-shots/huozi-yinshua.png',
  'assets/site-shots/pact-view.png',
  'assets/site-shots/periopact-mobile.png',
]) {
  assert.ok(existsSync(path.join(root, asset)), `${asset} should exist`);
  assert.ok(html.includes(asset.replaceAll('\\', '/')), `index.html should reference ${asset}`);
}

assert.match(html, /prefers-reduced-motion/, 'index.html should include reduced-motion handling');
assert.match(html, /anime\.animate|window\.anime/, 'index.html should use Anime.js');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/homepage-smoke.test.mjs`

Expected: FAIL with `index.html should exist`.

---

### Task 2: Static Assets

**Files:**
- Create: `assets/anime.umd.min.js`
- Create: `assets/site-shots/periopact-main.png`
- Create: `assets/site-shots/huozi-yinshua.png`
- Create: `assets/site-shots/pact-view.png`
- Create: `assets/site-shots/periopact-mobile.png`

- [ ] **Step 1: Copy the approved local assets**

Run:

```powershell
New-Item -ItemType Directory -Force -Path assets, assets/site-shots | Out-Null
Copy-Item -LiteralPath "C:\Users\21319\Desktop\05_软件工具与插件\anime-4.4.1\dist\bundles\anime.umd.min.js" -Destination "assets\anime.umd.min.js" -Force
Copy-Item -LiteralPath ".superpowers\brainstorm\54b93f2e9f224c2aa22143f7353c1c46\content\site-shots\periopact-main.png" -Destination "assets\site-shots\periopact-main.png" -Force
Copy-Item -LiteralPath ".superpowers\brainstorm\54b93f2e9f224c2aa22143f7353c1c46\content\site-shots\huozi-yinshua.png" -Destination "assets\site-shots\huozi-yinshua.png" -Force
Copy-Item -LiteralPath ".superpowers\brainstorm\54b93f2e9f224c2aa22143f7353c1c46\content\site-shots\pact-view.png" -Destination "assets\site-shots\pact-view.png" -Force
Copy-Item -LiteralPath ".superpowers\brainstorm\54b93f2e9f224c2aa22143f7353c1c46\content\site-shots\periopact-mobile.png" -Destination "assets\site-shots\periopact-mobile.png" -Force
```

---

### Task 3: Homepage

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write the static homepage**

Create `index.html` with:

- header anchors for About, Websites, Contact,
- professional hero copy,
- four linked website cards with images and approved descriptions,
- contact section with editable email/profile fields,
- local `<script src="assets/anime.umd.min.js"></script>`,
- tiny inline Anime.js animation guarded by `prefers-reduced-motion`.

- [ ] **Step 2: Run smoke test to verify it passes**

Run: `node tests/homepage-smoke.test.mjs`

Expected: no output and exit code 0.

---

### Task 4: Browser Verification

**Files:**
- Create: `output/playwright/homepage-desktop.png`
- Create: `output/playwright/homepage-mobile.png`

- [ ] **Step 1: Capture desktop and mobile screenshots**

Run:

```powershell
New-Item -ItemType Directory -Force -Path output/playwright | Out-Null
npx --yes playwright screenshot --viewport-size "1440,1000" "file:///C:/Users/21319/Documents/%E4%B8%AA%E4%BA%BA%E7%BD%91%E9%A1%B5/index.html" "output/playwright/homepage-desktop.png"
npx --yes playwright screenshot --viewport-size "390,844" "file:///C:/Users/21319/Documents/%E4%B8%AA%E4%BA%BA%E7%BD%91%E9%A1%B5/index.html" "output/playwright/homepage-mobile.png"
```

- [ ] **Step 2: Inspect screenshots**

Expected: screenshots show a nonblank page, all cards have images, and text does not visibly overlap.
