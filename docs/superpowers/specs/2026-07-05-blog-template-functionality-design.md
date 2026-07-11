# Blog Template Functionality Design

## Goal

Make the blog usable as a lightweight writing system without adding a CMS or backend.

## Design

- Essays live as Markdown files in `content/posts/`.
- `npm run new:post -- "文章标题"` creates a new Markdown file from a fixed frontmatter template.
- The React app loads Markdown files at build time with Vite `import.meta.glob`.
- The blog index lists all posts from Markdown metadata.
- A single article template renders selected posts through `/blog/index.html?post=<slug>`.
- `/blog/first-essay.html` remains a compatibility route for the first essay.

## Markdown Template

```markdown
---
title: 文章标题
date: 2026-07-05
category: 随笔
excerpt: 在这里写一句摘要
---

# 文章标题

在这里开始写正文。
```

## Out of Scope

- Online editor.
- Database.
- Login.
- Search.
- Tags beyond a simple category string.

