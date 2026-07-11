import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  addTimelineUpdate,
  moveTimelineUpdate,
  removeTimelineUpdate,
} from '../admin/timeline-state.js';
import { readTimeline, saveTimeline } from '../scripts/admin-server.mjs';
import { getTimelineUpdateView } from '../src/timeline.js';

const one = { title: '一' };
const two = { title: '二' };
const three = { title: '三' };

assert.deepEqual(getTimelineUpdateView(null, false), {
  updates: [],
  visibleCount: 0,
  hiddenCount: 0,
});
assert.equal(getTimelineUpdateView([one], false).visibleCount, 1);
assert.equal(getTimelineUpdateView([one, two], false).visibleCount, 2);
assert.deepEqual(getTimelineUpdateView([one, two, three], false), {
  updates: [one, two, three],
  visibleCount: 2,
  hiddenCount: 1,
});
assert.equal(getTimelineUpdateView([one, two, three], true).visibleCount, 3);

const entries = [{ title: '主项目', updates: [] }];
assert.equal(addTimelineUpdate(entries, 0), 0);
Object.assign(entries[0].updates[0], { date: '2026-01', title: '更新 A', text: '第一条' });
assert.equal(addTimelineUpdate(entries, 0), 0);
Object.assign(entries[0].updates[0], { date: '2026-02', title: '更新 B', text: '第二条' });
assert.deepEqual(entries[0].updates.map(update => update.title), ['更新 B', '更新 A']);

assert.equal(moveTimelineUpdate(entries, 0, 1, -1), 0);
assert.deepEqual(entries[0].updates.map(update => update.title), ['更新 A', '更新 B']);
assert.equal(moveTimelineUpdate(entries, 0, 0, -1), 0);

assert.equal(removeTimelineUpdate(entries, 0, 1), 0);
assert.deepEqual(entries[0].updates.map(update => update.title), ['更新 A']);

const workspace = mkdtempSync(path.join(tmpdir(), 'wxg-timeline-state-'));
saveTimeline(workspace, entries);
assert.deepEqual(readTimeline(workspace)[0].updates, [
  { date: '2026-01', title: '更新 A', text: '第一条' },
]);

assert.equal(removeTimelineUpdate(entries, 0, 0), -1);
assert.deepEqual(entries[0].updates, []);

console.log('timeline-state tests passed');
