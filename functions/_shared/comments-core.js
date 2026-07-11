// 评论/问题收集的核心逻辑。
// 与运行环境无关：生产端(Cloudflare Pages Functions + KV)和本地 dev 中间件
// 都通过同一个 store 接口调用这里，保证行为一致、可单测。
//
// store 接口：
//   getIdentity(ip) -> {nickname, email, createdAt, lastCommentAt} | null
//   putIdentity(ip, identity) -> void
//   putComment(comment) -> void            // comment.id 唯一
//   listComments() -> comment[]            // 任意顺序，核心负责排序
//   deleteComment(id) -> void

const MAX_CONTENT = 2000;
const MAX_NICKNAME = 24;
const COOLDOWN_MS = 15 * 1000;

export const PUBLIC_COMMENT_FIELDS = ['id', 'page', 'nickname', 'content', 'createdAt', 'visibility', 'anonymous'];

function publicComment(comment) {
  const result = {};
  for (const key of PUBLIC_COMMENT_FIELDS) result[key] = comment[key];
  // 匿名评论对外只显示「匿名」，真实昵称仅站长后台可见
  if (comment.anonymous) result.nickname = '匿名';
  return result;
}

function publicIdentity(identity) {
  return identity ? { nickname: identity.nickname } : null;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function cleanText(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function makeCommentId(now, random = Math.random()) {
  return `${String(now).padStart(14, '0')}-${random.toString(36).slice(2, 8)}`;
}

export async function getComments(store, { page, ip }) {
  const identity = await store.getIdentity(ip);
  const all = await store.listComments();
  const comments = all
    .filter(comment => comment.visibility !== 'private') // 仅站长可见的留言不进公开列表
    .filter(comment => !page || comment.page === page)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(publicComment);
  return { status: 200, body: { comments, identity: publicIdentity(identity) } };
}

export async function postComment(store, { page, ip, nickname, email, content, visibility, anonymous, now = Date.now() }) {
  const cleanContent = String(content ?? '').trim().slice(0, MAX_CONTENT);
  const cleanPage = cleanText(page, 120) || 'site';
  if (!cleanContent) {
    return { status: 400, body: { error: '请填写内容。' } };
  }
  if (!ip) {
    return { status: 400, body: { error: '无法识别来源，请稍后再试。' } };
  }

  let identity = await store.getIdentity(ip);

  if (identity && identity.lastCommentAt && now - identity.lastCommentAt < COOLDOWN_MS) {
    return { status: 429, body: { error: '发送太频繁了，请稍等几秒再试。' } };
  }

  if (!identity) {
    const cleanNickname = cleanText(nickname, MAX_NICKNAME);
    const cleanEmail = cleanText(email, 254);
    if (!cleanNickname) {
      return { status: 400, body: { error: '第一次留言需要填写昵称。', needIdentity: true } };
    }
    if (!isValidEmail(cleanEmail)) {
      return { status: 400, body: { error: '请填写有效的邮箱（仅用作注册用途，不会公开）。', needIdentity: true } };
    }
    identity = {
      nickname: cleanNickname,
      email: cleanEmail,
      createdAt: new Date(now).toISOString(),
      lastCommentAt: 0,
    };
  }

  const comment = {
    id: makeCommentId(now),
    page: cleanPage,
    nickname: identity.nickname,
    email: identity.email,
    ip,
    content: cleanContent,
    visibility: visibility === 'private' ? 'private' : 'public',
    anonymous: anonymous === true,
    createdAt: new Date(now).toISOString(),
  };

  await store.putComment(comment);
  await store.putIdentity(ip, { ...identity, lastCommentAt: now });

  return {
    status: 200,
    body: { ok: true, comment: publicComment(comment), identity: publicIdentity(identity) },
  };
}

export async function listAllComments(store) {
  const all = await store.listComments();
  const comments = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { status: 200, body: { comments } };
}

export async function removeComment(store, id) {
  if (!id) return { status: 400, body: { error: 'Missing comment id' } };
  await store.deleteComment(id);
  return { status: 200, body: { ok: true } };
}

// 站长在后台切换某条留言的公开/私密（不改动其它字段）。
// 依赖 store.putComment 按 id 覆盖写入（KV 天然如此；本地 dev store 已做 upsert）。
export async function setCommentVisibility(store, id, visibility) {
  if (!id) return { status: 400, body: { error: 'Missing comment id' } };
  if (visibility !== 'public' && visibility !== 'private') {
    return { status: 400, body: { error: 'visibility 只能是 public 或 private。' } };
  }
  const all = await store.listComments();
  const comment = all.find(item => item.id === id);
  if (!comment) return { status: 404, body: { error: '找不到这条留言。' } };
  await store.putComment({ ...comment, visibility });
  return { status: 200, body: { ok: true, id, visibility } };
}

export function checkAdminAuth(authHeader, adminToken) {
  if (!adminToken) {
    return {
      ok: false,
      status: 503,
      error: '评论后台未配置：请为站点设置 COMMENTS_ADMIN_TOKEN 环境变量。',
    };
  }
  const provided = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!provided || provided !== adminToken) {
    return { ok: false, status: 401, error: '管理口令不正确。' };
  }
  return { ok: true };
}
