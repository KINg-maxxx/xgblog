# Nested Timeline Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compact, collapsible child updates to each major timeline item and make those updates fully editable in the existing local admin.

**Architecture:** Extend each object in `content/timeline.json` with an optional one-level `updates` array. The existing admin server remains the validation and persistence boundary; React renders the first two child updates by default and owns only the expanded/collapsed UI state; the existing vanilla-JS admin editor manages nested child fields in place.

**Tech Stack:** React 19, vanilla CSS, Node.js standard library, existing vanilla-JS admin, Vite 5. No new dependencies.

## Global Constraints

- Child updates support exactly one level of nesting.
- Child update `title` is required; `date` and `text` may be empty.
- Array order is display order, newest first; the admin owns ordering.
- Show the first two child updates by default and fold the remainder.
- Preserve old timeline records that do not contain `updates`.
- Use no nested cards, rich text, attachments, separate detail pages, or automatic date sorting.
- Preserve keyboard access, `aria-expanded`, visible focus, responsive wrapping, and reduced-motion behavior.

---

### Task 1: Validate and Persist Child Updates

**Files:**
- Modify: `tests/admin-server.test.mjs`
- Modify: `scripts/admin-server.mjs:109-140`

**Interfaces:**
- Consumes: `saveTimeline(root, entries)` with timeline entries that may contain `updates`.
- Produces: normalized `updates: Array<{ date: string, title: string, text: string }>` on saved entries.

- [x] **Step 1: Write the failing server test**

Add a child update to `savedTimeline`, assert whitespace cleanup and round-trip persistence, and add a missing-title assertion:

```js
const savedTimeline = saveTimeline(workspace, [
  {
    period: '2026 · 至今',
    title: '进行中的项目',
    text: '描述一',
    status: 'doing',
    updates: [
      { date: ' 2026-07 ', title: ' 子更新 ', text: ' 说明 ' },
    ],
  },
  { title: '只有标题', status: '乱填的状态' },
]);
assert.deepEqual(savedTimeline[0].updates, [
  { date: '2026-07', title: '子更新', text: '说明' },
]);
assert.deepEqual(savedTimeline[1].updates, []);
assert.throws(
  () => saveTimeline(workspace, [{ title: '主项目', updates: [{ text: '缺标题' }] }]),
  /第 1 条历程的第 1 条子更新缺少标题/,
);
```

- [x] **Step 2: Run the test to verify RED**

Run: `node tests/admin-server.test.mjs`

Expected: FAIL because `saveTimeline` drops `updates`.

- [x] **Step 3: Add minimal nested normalization**

Inside `saveTimeline`, normalize each entry with this logic:

```js
const updates = Array.isArray(entry.updates) ? entry.updates : [];
const cleanUpdates = updates.map((update, updateIndex) => {
  const updateTitle = oneLine(update && update.title);
  if (!updateTitle) {
    throw new Error(`第 ${index + 1} 条历程的第 ${updateIndex + 1} 条子更新缺少标题`);
  }
  return {
    date: oneLine(update.date),
    title: updateTitle,
    text: oneLine(update.text),
  };
});
```

Return `updates: cleanUpdates` with the existing normalized parent fields.

- [x] **Step 4: Run the server test to verify GREEN**

Run: `node tests/admin-server.test.mjs`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add tests/admin-server.test.mjs scripts/admin-server.mjs
git commit -m "feat: persist timeline child updates"
```

### Task 2: Render the Compact Collapsible Branch

**Files:**
- Modify: `tests/homepage-smoke.test.mjs`
- Modify: `src/App.jsx:252-278`
- Modify: `src/styles.css:983-1074`

**Interfaces:**
- Consumes: `item.updates` from the imported timeline JSON.
- Produces: `TimelineItem({ item })`, rendering two updates by default and an accessible expansion button when `updates.length > 2`.

- [ ] **Step 1: Write the failing homepage structure test**

Add source assertions that describe the public contract:

```js
assert.ok(app.includes('function TimelineItem'), 'timeline should use a focused item component');
assert.ok(app.includes('slice(0, 2)'), 'timeline should show two child updates by default');
assert.ok(app.includes('aria-expanded'), 'timeline expansion control should expose its state');
assert.ok(app.includes('timeline-subupdates'), 'timeline should render a nested visual branch');
assert.match(read('src/styles.css'), /\.timeline-subupdate/);
```

- [ ] **Step 2: Run the test to verify RED**

Run: `node tests/homepage-smoke.test.mjs`

Expected: FAIL because the timeline has no child-update component or styles.

- [ ] **Step 3: Add the minimal React behavior**

Create a local component above `App`:

```jsx
function TimelineItem({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const updates = Array.isArray(item.updates) ? item.updates : [];
  const visibleUpdates = expanded ? updates : updates.slice(0, 2);
  const hiddenCount = Math.max(0, updates.length - 2);
  const updatesId = `timeline-updates-${index}`;

  return (
    <div className={`timeline-item ${item.status === 'doing' ? 'is-doing' : ''}`}>
      <span className="timeline-dot" aria-hidden="true" />
      <div className="timeline-body">
        <div className="timeline-meta">
          <span className="timeline-period">{item.period}</span>
          {item.status === 'doing' && <span className="timeline-badge">进行中</span>}
        </div>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
      </div>
      {updates.length > 0 && (
        <div className="timeline-subupdates" id={updatesId}>
          {visibleUpdates.map((update, index) => (
            <article className="timeline-subupdate" key={`${update.date}-${update.title}-${index}`}>
              <span className="timeline-subdot" aria-hidden="true" />
              <div>
                {update.date && <time>{update.date}</time>}
                <h4>{update.title}</h4>
                {update.text && <p>{update.text}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
      {hiddenCount > 0 && (
        <button
          className="timeline-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={updatesId}
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? '收起' : `展开其余 ${hiddenCount} 条`}
          <span aria-hidden="true">⌄</span>
        </button>
      )}
    </div>
  );
}
```

Replace the inline timeline item body with `<TimelineItem item={item} index={index} />`, and change the map callback to receive `index`.

- [ ] **Step 4: Add the visual branch styles**

Use existing variables and add these focused styles:

```css
.timeline-subupdates {
  position: relative;
  display: grid;
  margin-top: 16px;
  padding-left: 18px;
}
.timeline-subupdates::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 5px;
  bottom: 18px;
  width: 1px;
  background: var(--line);
}
.timeline-subupdate {
  position: relative;
  padding: 0 0 14px 18px;
  animation: timeline-subupdate-in 240ms ease-out both;
}
.timeline-subdot {
  position: absolute;
  left: -18px;
  top: 6px;
  width: 6px;
  height: 6px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--paper-soft);
}
.timeline-subupdate h4 {
  margin: 1px 0 0;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.45;
}
.timeline-subupdate time,
.timeline-subupdate p {
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.65;
}
.timeline-subupdate p { margin: 3px 0 0; max-width: 580px; }
.timeline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  margin: 0 0 0 18px;
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}
.timeline-toggle span { transition: transform 180ms ease; }
.timeline-toggle[aria-expanded="true"] span { transform: rotate(180deg); }
.timeline-toggle:hover { color: var(--red); }
.timeline-toggle:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
@keyframes timeline-subupdate-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 640px) {
  .timeline-item { padding-left: 32px; }
  .timeline-subupdates { padding-left: 14px; }
  .timeline-subupdate { padding-left: 16px; }
  .timeline-subdot { left: -14px; }
}
```

- [ ] **Step 5: Run the homepage test to verify GREEN**

Run: `node tests/homepage-smoke.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/homepage-smoke.test.mjs src/App.jsx src/styles.css
git commit -m "feat: render collapsible timeline updates"
```

### Task 3: Edit Child Updates in the Existing Admin

**Files:**
- Modify: `tests/homepage-smoke.test.mjs`
- Modify: `admin/admin.js:314-447`
- Modify: `admin/admin.css:641-776`

**Interfaces:**
- Consumes: `entry.updates` returned by `/api/timeline`.
- Produces: nested editable arrays in `timelineEntries`, submitted unchanged through the existing `saveTimelinePayload()`.

- [ ] **Step 1: Write the failing admin source test**

Add these assertions:

```js
assert.ok(adminJs.includes('addTimelineUpdate'), 'admin should add child updates');
assert.ok(adminJs.includes('moveTimelineUpdate'), 'admin should reorder child updates');
assert.ok(adminJs.includes('removeTimelineUpdate'), 'admin should delete child updates');
assert.ok(adminJs.includes('timeline-subentry'), 'admin should render child update editors');
```

- [ ] **Step 2: Run the test to verify RED**

Run: `node tests/homepage-smoke.test.mjs`

Expected: FAIL because the admin has no child-update controls.

- [ ] **Step 3: Add nested list mutations**

Add minimal functions that mutate `entry.updates` and call `renderTimeline()`:

```js
function addTimelineUpdate(entryIndex) {
  const updates = timelineEntries[entryIndex].updates ||= [];
  updates.unshift({ date: '', title: '新的子更新', text: '' });
  renderTimeline();
}

function moveTimelineUpdate(entryIndex, updateIndex, direction) {
  const updates = timelineEntries[entryIndex].updates || [];
  const target = updateIndex + direction;
  if (target < 0 || target >= updates.length) return;
  const [update] = updates.splice(updateIndex, 1);
  updates.splice(target, 0, update);
  renderTimeline();
}

function removeTimelineUpdate(entryIndex, updateIndex) {
  if (!window.confirm('删除这条子更新？')) return;
  timelineEntries[entryIndex].updates.splice(updateIndex, 1);
  renderTimeline();
}
```

- [ ] **Step 4: Render child update editors**

Add this focused renderer using the existing form helpers:

```js
function renderTimelineUpdate(update, entryIndex, updateIndex, updateCount) {
  const item = document.createElement('div');
  item.className = 'timeline-subentry';

  const head = document.createElement('div');
  head.className = 'timeline-subentry-head';
  const label = document.createElement('strong');
  label.textContent = `子更新 ${updateIndex + 1}`;
  const controls = document.createElement('div');
  controls.className = 'timeline-controls';
  const up = iconButton('↑', '上移子更新', () => moveTimelineUpdate(entryIndex, updateIndex, -1));
  const down = iconButton('↓', '下移子更新', () => moveTimelineUpdate(entryIndex, updateIndex, 1));
  up.disabled = updateIndex === 0;
  down.disabled = updateIndex === updateCount - 1;
  controls.append(up, down, iconButton('删除', '删除子更新', () => removeTimelineUpdate(entryIndex, updateIndex), 'danger'));
  head.append(label, controls);

  const grid = document.createElement('div');
  grid.className = 'timeline-subgrid';
  grid.appendChild(fieldBlock('日期', textInput(update.date || '', value => { update.date = value; })));
  grid.appendChild(fieldBlock('标题', textInput(update.title || '', value => { update.title = value; })));
  item.append(head, grid, fieldBlock('描述', textArea(update.text || '', value => { update.text = value; })));
  return item;
}
```

Then append the nested editor at the end of `renderTimelineEntry`:

```js
const updates = Array.isArray(entry.updates) ? entry.updates : (entry.updates = []);
const subeditor = document.createElement('section');
subeditor.className = 'timeline-subeditor';
const subhead = document.createElement('div');
subhead.className = 'timeline-subeditor-head';
const subheading = document.createElement('strong');
subheading.textContent = `子更新 · ${updates.length}`;
subhead.append(subheading, iconButton('+', '添加子更新', () => addTimelineUpdate(index)));
const sublist = document.createElement('div');
sublist.className = 'timeline-sublist';
updates.forEach((update, updateIndex) => {
  sublist.appendChild(renderTimelineUpdate(update, index, updateIndex, updates.length));
});
subeditor.append(subhead, sublist);
card.appendChild(subeditor);
```

- [ ] **Step 5: Style the nested editor**

Add these styles. The left rule carries hierarchy without creating a nested card:

```css
.timeline-subeditor {
  display: grid;
  gap: 10px;
  margin-top: 2px;
  padding: 14px 0 0 16px;
  border-left: 1px solid var(--line);
}
.timeline-subeditor-head,
.timeline-subentry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.timeline-subeditor-head > strong,
.timeline-subentry-head > strong {
  color: var(--muted);
  font-size: 0.82rem;
}
.timeline-subeditor-head > button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-size: 1rem;
}
.timeline-sublist { display: grid; gap: 14px; }
.timeline-subentry {
  display: grid;
  gap: 10px;
  padding: 2px 0 14px;
  border-bottom: 1px solid var(--line);
}
.timeline-subentry:last-child { padding-bottom: 0; border-bottom: 0; }
.timeline-subgrid {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 10px;
}
@media (max-width: 720px) {
  .timeline-subgrid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 6: Run the homepage test to verify GREEN**

Run: `node tests/homepage-smoke.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/homepage-smoke.test.mjs admin/admin.js admin/admin.css
git commit -m "feat: edit timeline child updates"
```

### Task 4: Restructure Real Timeline Content and Verify End to End

**Files:**
- Modify: `content/timeline.json`

**Interfaces:**
- Consumes: the validated child-update schema from Task 1.
- Produces: visible examples with at least one parent containing three child updates, proving the default fold on the public page.

- [ ] **Step 1: Write the failing content assertion**

In `tests/homepage-smoke.test.mjs`, parse `content/timeline.json` and assert:

```js
const timeline = JSON.parse(read('content/timeline.json'));
assert.ok(timeline.some(item => item.updates?.length >= 3), 'timeline should demonstrate folded child updates');
```

- [ ] **Step 2: Run the test to verify RED**

Run: `node tests/homepage-smoke.test.mjs`

Expected: FAIL because current timeline entries have no `updates`.

- [ ] **Step 3: Group existing milestones under their projects**

Move existing facts without inventing project claims. Use these child records:

```json
{
  "title": "PACT 随访管理平台",
  "updates": [
    {
      "date": "2026",
      "title": "PerioPACT 主站与移动端上线",
      "text": "牙周诊疗与随访管理的主工作区投入使用，并提供面向诊间场景的移动端入口。"
    },
    {
      "date": "2026",
      "title": "PACT View 上线",
      "text": "浏览器可直接查看 CBCT、口扫等三维口腔影像，用于医患沟通与病例讨论。"
    }
  ]
}
```

```json
{
  "title": "本站：工具入口 → 个人站点",
  "updates": [
    {
      "date": "2026-07-12",
      "title": "正确源码恢复并接入 GitHub",
      "text": "恢复与线上版本一致的源码，并建立 main 分支进行版本管理。"
    },
    {
      "date": "2026-07",
      "title": "评论功能上线",
      "text": "随笔文章支持留言交流，邮箱与 IP 不公开。"
    },
    {
      "date": "2026-07",
      "title": "标注工作台并入工具入口",
      "text": "多模态口腔文字标注工作台加入网站入口，支持 JSON / TSV 导出。"
    }
  ]
}
```

Remove the duplicated top-level records after they become child updates. Keep `活字印刷上线` as an independent top-level milestone.

- [ ] **Step 4: Run all automated verification**

Run: `npm test && npm run build`

Expected: all five test scripts pass and Vite exits successfully.

- [ ] **Step 5: Verify desktop and mobile behavior**

Open the running local site at `http://127.0.0.1:4175/#timeline` at desktop and mobile widths. Confirm:

- only two of the three site updates show initially;
- the expansion button reveals the third and then collapses it;
- no text overlaps or horizontal scrolling;
- the branch is visually subordinate to its parent;
- keyboard focus is visible;
- the admin at `http://127.0.0.1:5180/` can add, edit, reorder, delete, save, and reload a child update.

- [ ] **Step 6: Commit and push**

```bash
git add tests/homepage-smoke.test.mjs content/timeline.json
git commit -m "content: group milestones as timeline updates"
git push origin main
```
