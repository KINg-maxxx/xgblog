import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import {
  getComments,
  listAllComments,
  postComment,
  removeComment,
  setCommentVisibility,
} from './functions/_shared/comments-core.js';

// 本地开发用的评论存储：与生产端(Cloudflare KV)共用同一套核心逻辑，
// 数据落在 .dev-data/comments.json（已 gitignore），仅供本地联调。
function createFileStore(file) {
  function load() {
    if (!existsSync(file)) return { identities: {}, comments: [] };
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return { identities: {}, comments: [] };
    }
  }

  function save(data) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  }

  return {
    async getIdentity(ip) {
      return load().identities[ip] || null;
    },
    async putIdentity(ip, identity) {
      const data = load();
      data.identities[ip] = identity;
      save(data);
    },
    async putComment(comment) {
      const data = load();
      // 按 id upsert：新评论追加，已存在则覆盖（供站长改可见性等更新用）
      const index = data.comments.findIndex(item => item.id === comment.id);
      if (index >= 0) data.comments[index] = comment;
      else data.comments.push(comment);
      save(data);
    },
    async listComments() {
      return load().comments;
    },
    async deleteComment(id) {
      const data = load();
      data.comments = data.comments.filter(comment => comment.id !== id);
      save(data);
    },
  };
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

// 与后台服务器同样的回环校验：Host 与 Origin(若有)都必须是本机回环地址。
// 挡住 DNS 重绑定读取评论者 PII，以及其他网页跨站读/删评论。
function isTrustedLocalRequest(req) {
  const host = hostnameFrom(req.headers.host);
  if (!host || !isLoopbackHostname(host)) return false;
  const origin = req.headers.origin;
  if (origin) {
    const originHost = hostnameFrom(origin, true);
    if (!originHost || !isLoopbackHostname(originHost)) return false;
  }
  return true;
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy(new Error('Payload too large'));
    });
    req.on('end', () => resolvePromise(body));
    req.on('error', reject);
  });
}

function commentsDevApi() {
  const store = createFileStore(resolve(__dirname, '.dev-data', 'comments.json'));

  return {
    name: 'comments-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/api/comments')) return next();

        if (!isTrustedLocalRequest(req)) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Forbidden: untrusted host or origin');
          return;
        }

        // 只把 CORS 放开给回环 Origin（如后台收件箱 http://127.0.0.1:5180），
        // 不再用 * 通配，避免任意网页读取评论 PII。同源请求无 Origin 时不需要该头。
        const corsOrigin = req.headers.origin || '';
        const corsHeaders = {
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          ...(corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin, Vary: 'Origin' } : {}),
        };

        const send = result => {
          res.writeHead(result.status, {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders,
          });
          res.end(JSON.stringify(result.body));
        };

        try {
          const ip = req.socket.remoteAddress || 'local';

          if (req.method === 'OPTIONS') {
            res.writeHead(204, corsHeaders);
            res.end();
            return;
          }

          if (url.pathname === '/api/comments' && req.method === 'GET') {
            send(await getComments(store, { page: url.searchParams.get('page') || '', ip }));
            return;
          }

          if (url.pathname === '/api/comments' && req.method === 'POST') {
            const payload = JSON.parse((await readBody(req)) || '{}');
            send(await postComment(store, { ...payload, ip }));
            return;
          }

          // 本地开发不校验管理口令，方便联调后台收件箱
          if (url.pathname === '/api/comments/all' && req.method === 'GET') {
            send(await listAllComments(store));
            return;
          }

          const idMatch = url.pathname.match(/^\/api\/comments\/([^/]+)$/);
          if (idMatch && req.method === 'PATCH') {
            const payload = JSON.parse((await readBody(req)) || '{}');
            send(await setCommentVisibility(store, decodeURIComponent(idMatch[1]), payload.visibility));
            return;
          }
          if (idMatch && req.method === 'DELETE') {
            send(await removeComment(store, decodeURIComponent(idMatch[1])));
            return;
          }

          send({ status: 405, body: { error: 'Method not allowed' } });
        } catch (error) {
          send({ status: 400, body: { error: error.message } });
        }
      });
    },
  };
}

// 本地开发时访问 /admin 直接跳到博客后台(需先运行 npm run admin,端口 5180)。
// 仅存在于 dev server,构建产物和线上站点不受影响。
function adminRedirect() {
  return {
    name: 'admin-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/admin' || url.pathname === '/admin/') {
          res.writeHead(302, { Location: 'http://127.0.0.1:5180/' });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [commentsDevApi(), adminRedirect()],
  server: {
    // 允许通过 PORT 环境变量指定端口（如 Claude Code preview 的 autoPort）
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        blog: resolve(__dirname, 'blog/index.html'),
        essay: resolve(__dirname, 'blog/first-essay.html'),
      },
    },
  },
});
