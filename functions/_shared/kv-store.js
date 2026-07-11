// Cloudflare KV 版的评论存储适配器。
// KV namespace 绑定名：COMMENTS（见 wrangler.toml.example / docs/comments-setup.md）。

const IDENTITY_PREFIX = 'identity:';
const COMMENT_PREFIX = 'comment:';

export function createKvStore(kv) {
  return {
    async getIdentity(ip) {
      const raw = await kv.get(`${IDENTITY_PREFIX}${ip}`);
      return raw ? JSON.parse(raw) : null;
    },
    async putIdentity(ip, identity) {
      await kv.put(`${IDENTITY_PREFIX}${ip}`, JSON.stringify(identity));
    },
    async putComment(comment) {
      await kv.put(`${COMMENT_PREFIX}${comment.id}`, JSON.stringify(comment));
    },
    async listComments() {
      const comments = [];
      let cursor;
      do {
        const page = await kv.list({ prefix: COMMENT_PREFIX, cursor });
        const values = await Promise.all(page.keys.map(key => kv.get(key.name)));
        for (const raw of values) {
          if (raw) comments.push(JSON.parse(raw));
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return comments;
    },
    async deleteComment(id) {
      await kv.delete(`${COMMENT_PREFIX}${id}`);
    },
  };
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function jsonResponse(result) {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function missingKvResponse() {
  return jsonResponse({
    status: 503,
    body: { error: '评论服务未配置：请为 Pages 项目绑定名为 COMMENTS 的 KV namespace。' },
  });
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '';
}
