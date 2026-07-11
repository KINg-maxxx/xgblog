import { renderMarkdown, splitFrontmatter } from '../lib/markdown.js';

const modules = import.meta.glob('../../content/posts/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
});

export const posts = Object.entries(modules)
  .map(([file, raw]) => {
    const slug = file.split('/').pop().replace(/\.md$/, '');
    const { body, meta } = splitFrontmatter(raw);

    return {
      slug,
      title: meta.title || slug,
      date: meta.date || '',
      category: meta.category || '随笔',
      excerpt: meta.excerpt || '',
      href: `/blog/index.html?post=${encodeURIComponent(slug)}`,
      html: renderMarkdown(body),
    };
  })
  .sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));

export function getPostBySlug(slug) {
  return posts.find(post => post.slug === slug);
}
