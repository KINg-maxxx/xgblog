import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), 'wxg-post-'));
const script = path.join(root, 'scripts', 'new-post.mjs');

execFileSync(process.execPath, [script, '测试文章'], {
  cwd: temp,
  env: { ...process.env, POST_DATE: '2026-07-05' },
});

const postPath = path.join(temp, 'content', 'posts', '2026-07-05-测试文章.md');
assert.ok(existsSync(postPath), 'generator should create a dated Markdown file');

const content = readFileSync(postPath, 'utf8');
assert.ok(content.includes('title: 测试文章'));
assert.ok(content.includes('date: 2026-07-05'));
assert.ok(content.includes('category: 随笔'));
assert.ok(content.includes('# 测试文章'));

const duplicate = spawnSync(process.execPath, [script, '测试文章'], {
  cwd: temp,
  env: { ...process.env, POST_DATE: '2026-07-05' },
  encoding: 'utf8',
});

assert.notEqual(duplicate.status, 0);
assert.match(duplicate.stderr, /already exists/);
