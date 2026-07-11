import assert from 'node:assert/strict';
import { renderMarkdown, splitFrontmatter } from '../src/lib/markdown.js';

// ---- frontmatter ----
const parsed = splitFrontmatter(`---
title: 标题
date: 2026-07-07
---

正文第一段。`);
assert.equal(parsed.meta.title, '标题');
assert.equal(parsed.meta.date, '2026-07-07');
assert.equal(parsed.body, '正文第一段。');

// ---- 富文本渲染 ----
const html = renderMarkdown(`# 一级标题

一段 **加粗**、*斜体* 和 \`行内代码\`，还有 [站外链接](https://www.periopact.cn/)。

- 无序一
- 无序二

1. 有序一
2. 有序二

> 一段引用

\`\`\`js
const x = 1;
\`\`\`

![截图](/assets/site-shots/pact-view.png)

| 列1 | 列2 |
|----|----|
| a  | b  |`);

// 正文一级标题被下移为 <h2>（页面标题占用了 <h1>）
assert.match(html, /<h2[^>]*>一级标题<\/h2>/);
// 行内格式
assert.match(html, /<strong>加粗<\/strong>/);
assert.match(html, /<em>斜体<\/em>/);
assert.match(html, /<code>行内代码<\/code>/);
// 站外链接在新标签打开
assert.match(html, /<a href="https:\/\/www\.periopact\.cn\/" target="_blank" rel="noreferrer">站外链接<\/a>/);
// 列表 / 代码块 / 图片 / 表格
assert.match(html, /<ul>[\s\S]*<li>无序一<\/li>/);
assert.match(html, /<ol>[\s\S]*<li>有序一<\/li>/);
assert.match(html, /<blockquote>[\s\S]*一段引用/);
assert.match(html, /<pre><code[^>]*>const x = 1;/);
assert.match(html, /<img src="\/assets\/site-shots\/pact-view\.png" alt="截图"/);
assert.match(html, /<table>[\s\S]*<th>列1<\/th>/);

// 空输入不报错
assert.equal(renderMarkdown('').trim(), '');

console.log('markdown-parser tests passed');
