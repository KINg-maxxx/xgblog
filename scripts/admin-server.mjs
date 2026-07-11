import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from '../src/lib/markdown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const host = '127.0.0.1';
const port = Number(process.env.ADMIN_PORT || 5180);

function postsDir(root = projectRoot) {
  return path.resolve(root, 'content', 'posts');
}

function ensurePostsDir(root = projectRoot) {
  const dir = postsDir(root);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function assertSlug(slug) {
  if (!slug || slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    throw new Error('Invalid post slug');
  }
}

function postPath(root, slug) {
  assertSlug(slug);
  const dir = ensurePostsDir(root);
  const file = path.resolve(dir, `${slug}.md`);
  if (!file.startsWith(`${dir}${path.sep}`)) throw new Error('Invalid post slug');
  return file;
}

export function slugifyTitle(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80) || 'post';
}

function oneLine(value = '') {
  return String(value).replace(/\r?\n/g, ' ').trim();
}

function markdownForPost(post) {
  return `---
title: ${oneLine(post.title)}
date: ${oneLine(post.date)}
category: ${oneLine(post.category || '随笔')}
excerpt: ${oneLine(post.excerpt)}
---

${String(post.body || '').trim()}
`;
}

export function readPost(root, slug) {
  const file = postPath(root, slug);
  const raw = readFileSync(file, 'utf8');
  const { body, meta } = splitFrontmatter(raw);
  return {
    slug,
    title: meta.title || slug,
    date: meta.date || '',
    category: meta.category || '随笔',
    excerpt: meta.excerpt || '',
    body,
  };
}

export function listPosts(root = projectRoot) {
  const dir = ensurePostsDir(root);
  return readdirSync(dir)
    .filter(name => name.endsWith('.md'))
    .map(name => readPost(root, name.replace(/\.md$/, '')))
    .sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
}

export function savePost(root, post) {
  const title = oneLine(post.title);
  const date = oneLine(post.date);
  if (!title) throw new Error('Title is required');
  if (!date) throw new Error('Date is required');

  const slug = `${date}-${slugifyTitle(title)}`;
  const file = postPath(root, slug);
  const originalSlug = oneLine(post.originalSlug);
  if (originalSlug && originalSlug !== slug) {
    const originalFile = postPath(root, originalSlug);
    if (existsSync(file)) throw new Error(`Post already exists: ${slug}`);
    if (existsSync(originalFile)) unlinkSync(originalFile);
  }

  writeFileSync(file, markdownForPost({ ...post, title, date }), 'utf8');
  return readPost(root, slug);
}

export function deletePost(root, slug) {
  const file = postPath(root, slug);
  if (existsSync(file)) unlinkSync(file);
}

const TIMELINE_STATUSES = new Set(['doing', 'done']);

function timelinePath(root = projectRoot) {
  return path.resolve(root, 'content', 'timeline.json');
}

export function readTimeline(root = projectRoot) {
  const file = timelinePath(root);
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveTimeline(root, entries) {
  if (!Array.isArray(entries)) throw new Error('Timeline must be an array');
  const clean = entries.map((entry, index) => {
    const title = oneLine(entry && entry.title);
    if (!title) throw new Error(`第 ${index + 1} 条缺少标题`);
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
    return {
      period: oneLine(entry.period),
      title,
      text: oneLine(entry.text),
      status: TIMELINE_STATUSES.has(entry.status) ? entry.status : 'done',
      updates: cleanUpdates,
    };
  });
  mkdirSync(path.resolve(root, 'content'), { recursive: true });
  writeFileSync(timelinePath(root), `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
  return clean;
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const isWindowsCommand = process.platform === 'win32' && /\.cmd$/i.test(command);
    const child = spawn(
      isWindowsCommand ? process.env.ComSpec || 'cmd.exe' : command,
      isWindowsCommand ? ['/d', '/s', '/c', command, ...args] : args,
      {
      cwd: options.cwd || projectRoot,
      windowsHide: true,
      },
    );
    let output = '';

    child.stdout.on('data', chunk => {
      output += chunk;
    });
    child.stderr.on('data', chunk => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('close', code => resolve({ code, output: output.trim() }));
  });
}

export async function publishSite(root = projectRoot, options = {}) {
  const runner = options.runCommand || runCommand;
  const result = await runner(npmCommand(), ['run', 'deploy'], { cwd: root });
  if (result.code !== 0) {
    const error = new Error(result.output || 'Deploy failed');
    error.status = 500;
    throw error;
  }
  return { ok: true, output: result.output };
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) request.destroy(new Error('Payload too large'));
    });
    request.on('end', () => resolve(body ? JSON.parse(body) : {}));
    request.on('error', reject);
  });
}

function serveStatic(response, pathname) {
  const safeName = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (safeName.includes('..') || safeName.includes('\\')) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  const file = path.resolve(projectRoot, 'admin', safeName);
  const base = path.resolve(projectRoot, 'admin');
  if (!file.startsWith(`${base}${path.sep}`) && file !== path.join(base, 'index.html')) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  if (!existsSync(file)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  const ext = path.extname(file);
  const type = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html';
  response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
  response.end(readFileSync(file));
}

function hostnameFrom(headerValue, isOrigin = false) {
  if (!headerValue) return null;
  try {
    return new URL(isOrigin ? headerValue : `http://${headerValue}`).hostname;
  } catch {
    return null;
  }
}

function isLoopbackHostname(name) {
  return name === '127.0.0.1' || name === 'localhost' || name === '::1' || name === '[::1]';
}

// 只信任本机回环发来的请求：
// - Host 头必须是 127.0.0.1 / localhost，挡住把恶意域名解析到 127.0.0.1 的 DNS 重绑定攻击
//   （那种攻击请求携带的 Host 是 evil.com，不是回环地址）。
// - 若带 Origin，也必须是回环地址，挡住其他网页借用户浏览器发来的跨站写请求（CSRF）。
//   后台自身的同源请求 Origin 是 http://127.0.0.1:PORT（回环，放行）；curl 等不带 Origin 也放行。
function isTrustedLocalRequest(request) {
  const host = hostnameFrom(request.headers.host);
  if (!host || !isLoopbackHostname(host)) return false;
  const origin = request.headers.origin;
  if (origin) {
    const originHost = hostnameFrom(origin, true);
    if (!originHost || !isLoopbackHostname(originHost)) return false;
  }
  return true;
}

export function createAdminServer(root = projectRoot, options = {}) {
  let activePublish = null;

  return createServer(async (request, response) => {
    try {
      if (!isTrustedLocalRequest(request)) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Forbidden: untrusted host or origin');
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host}`);
      const slugMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);

      if (request.method === 'GET' && url.pathname === '/api/posts') {
        sendJson(response, 200, { posts: listPosts(root) });
        return;
      }

      if (request.method === 'GET' && slugMatch) {
        sendJson(response, 200, { post: readPost(root, decodeURIComponent(slugMatch[1])) });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/posts') {
        sendJson(response, 200, { post: savePost(root, await readJson(request)) });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/timeline') {
        sendJson(response, 200, { timeline: readTimeline(root) });
        return;
      }

      if (request.method === 'PUT' && url.pathname === '/api/timeline') {
        const body = await readJson(request);
        sendJson(response, 200, { timeline: saveTimeline(root, body.timeline) });
        return;
      }

      if (request.method === 'DELETE' && slugMatch) {
        deletePost(root, decodeURIComponent(slugMatch[1]));
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/publish') {
        if (activePublish) {
          sendJson(response, 409, { error: 'Publish already running' });
          return;
        }

        const publish = options.publishSite || publishSite;
        activePublish = Promise.resolve().then(() => publish(root));
        try {
          sendJson(response, 200, { publish: await activePublish });
        } finally {
          activePublish = null;
        }
        return;
      }

      if (request.method === 'GET') {
        serveStatic(response, url.pathname);
        return;
      }

      response.writeHead(405);
      response.end('Method not allowed');
    } catch (error) {
      sendJson(response, error.status || 400, { error: error.message });
    }
  });
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  createAdminServer().listen(port, host, () => {
    console.log(`Blog admin: http://${host}:${port}/`);
  });
}
