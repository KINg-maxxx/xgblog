import { Marked } from 'marked';

// 正文渲染：与后台实时预览共用同一套规则（后台加载 admin/vendor/marked.umd.js）。
// 正文里的标题整体下移一级（# → <h2>），避免和页面标题 <h1> 冲突。
const markdownRenderer = new Marked({ gfm: true, breaks: false });
markdownRenderer.use({
  walkTokens(token) {
    if (token.type === 'heading') token.depth = Math.min(token.depth + 1, 6);
  },
});

export function renderMarkdown(body = '') {
  const html = markdownRenderer.parse(body);
  // 站外链接在新标签打开，避免读者离开博客
  return html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noreferrer"');
}

export function splitFrontmatter(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return { meta: {}, body: normalized.trim() };

  const end = normalized.indexOf('\n---', 4);
  if (end === -1) return { meta: {}, body: normalized.trim() };

  const meta = {};
  const header = normalized.slice(4, end).trim();
  for (const line of header.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) meta[match[1]] = match[2].trim();
  }

  return { meta, body: normalized.slice(end + 4).trim() };
}
