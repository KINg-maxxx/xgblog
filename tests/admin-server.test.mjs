import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  deletePost,
  listPosts,
  publishSite,
  readPost,
  readTimeline,
  runCommand,
  savePost,
  saveTimeline,
  slugifyTitle,
} from '../scripts/admin-server.mjs';

const workspace = mkdtempSync(path.join(tmpdir(), 'wxg-admin-'));

assert.equal(slugifyTitle('Test Post / A'), 'Test-Post-A');

const saved = savePost(workspace, {
  title: 'Test Post',
  date: '2026-07-05',
  category: 'Note',
  excerpt: 'One line summary',
  body: '# Test Post\n\nBody text.',
});

assert.equal(saved.slug, '2026-07-05-Test-Post');
assert.ok(existsSync(path.join(workspace, 'content', 'posts', '2026-07-05-Test-Post.md')));

const posts = listPosts(workspace);
assert.equal(posts.length, 1);
assert.equal(posts[0].title, 'Test Post');

const post = readPost(workspace, saved.slug);
assert.equal(post.title, 'Test Post');
assert.equal(post.body.trim(), '# Test Post\n\nBody text.');

const renamed = savePost(workspace, {
  originalSlug: saved.slug,
  title: 'Renamed Post',
  date: '2026-07-06',
  category: 'Guide',
  excerpt: 'New summary',
  body: 'New body.',
});

assert.equal(renamed.slug, '2026-07-06-Renamed-Post');
assert.equal(existsSync(path.join(workspace, 'content', 'posts', `${saved.slug}.md`)), false);

deletePost(workspace, renamed.slug);
assert.equal(listPosts(workspace).length, 0);

assert.throws(
  () => readPost(workspace, '../bad'),
  /Invalid post slug/,
);

// ---- 历程时间线读写 ----
assert.deepEqual(readTimeline(workspace), []);

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
assert.equal(savedTimeline.length, 2);
assert.equal(savedTimeline[0].status, 'doing');
assert.deepEqual(savedTimeline[0].updates, [
  { date: '2026-07', title: '子更新', text: '说明' },
]);
assert.equal(savedTimeline[1].status, 'done'); // 非法状态回退为 done
assert.equal(savedTimeline[1].period, ''); // 缺失字段补空串
assert.deepEqual(savedTimeline[1].updates, []);
assert.deepEqual(readTimeline(workspace), savedTimeline); // 写入后能原样读回

assert.throws(() => saveTimeline(workspace, [{ text: '缺标题' }]), /标题/);
assert.throws(
  () => saveTimeline(workspace, [{ title: '主项目', updates: [{ text: '缺标题' }] }]),
  /第 1 条历程的第 1 条子更新缺少标题/,
);
assert.throws(() => saveTimeline(workspace, 'not-an-array'), /array/);

const publishCalls = [];
const published = await publishSite(workspace, {
  runCommand(command, args, options) {
    publishCalls.push({ command, args, cwd: options.cwd });
    return Promise.resolve({ code: 0, output: 'published' });
  },
});

assert.equal(published.output, 'published');
assert.equal(publishCalls.length, 1);
assert.match(publishCalls[0].command, /^npm(\.cmd)?$/);
assert.deepEqual(publishCalls[0].args, ['run', 'deploy']);
assert.equal(publishCalls[0].cwd, workspace);

const npmVersion = await runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], {
  cwd: workspace,
});
assert.equal(npmVersion.code, 0);
assert.match(npmVersion.output, /\d+\.\d+\.\d+/);
