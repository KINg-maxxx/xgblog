import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  throw new Error('Usage: npm run new:post -- "文章标题"');
}

const date = process.env.POST_DATE || new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
}).format(new Date());

const slugTitle = title
  .replace(/[\\/:*?"<>|]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/\.+$/g, '')
  .slice(0, 80) || 'post';

const postsDir = path.join(process.cwd(), 'content', 'posts');
const postPath = path.join(postsDir, `${date}-${slugTitle}.md`);

if (existsSync(postPath)) {
  throw new Error(`Post already exists: ${postPath}`);
}

mkdirSync(postsDir, { recursive: true });
writeFileSync(postPath, `---
title: ${title}
date: ${date}
category: 随笔
excerpt: 在这里写一句摘要
---

# ${title}

在这里开始写正文。
`, 'utf8');

console.log(postPath);
