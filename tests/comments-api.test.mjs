import assert from 'node:assert/strict';
import {
  checkAdminAuth,
  getComments,
  listAllComments,
  postComment,
  removeComment,
  setCommentVisibility,
} from '../functions/_shared/comments-core.js';

function memoryStore() {
  const identities = new Map();
  const comments = new Map();
  return {
    async getIdentity(ip) {
      return identities.get(ip) || null;
    },
    async putIdentity(ip, identity) {
      identities.set(ip, identity);
    },
    async putComment(comment) {
      comments.set(comment.id, comment);
    },
    async listComments() {
      return [...comments.values()];
    },
    async deleteComment(id) {
      comments.delete(id);
    },
  };
}

const store = memoryStore();
const T0 = Date.parse('2026-07-06T10:00:00Z');

// 1. 首次评论必须提供昵称和邮箱
const missingIdentity = await postComment(store, {
  page: 'site', ip: '1.2.3.4', content: '第一个问题', now: T0,
});
assert.equal(missingIdentity.status, 400);
assert.equal(missingIdentity.body.needIdentity, true);

const badEmail = await postComment(store, {
  page: 'site', ip: '1.2.3.4', nickname: '小王', email: 'not-an-email', content: '第一个问题', now: T0,
});
assert.equal(badEmail.status, 400);

// 2. 合法首次评论：注册身份并发布
const first = await postComment(store, {
  page: 'site', ip: '1.2.3.4', nickname: '小王', email: 'xiaowang@example.com', content: '第一个问题', now: T0,
});
assert.equal(first.status, 200);
assert.equal(first.body.comment.nickname, '小王');
assert.equal(first.body.identity.nickname, '小王');
assert.equal(first.body.comment.email, undefined, '公开评论不应包含邮箱');
assert.equal(first.body.comment.ip, undefined, '公开评论不应包含 IP');

// 3. 冷却时间内再次发送被拒绝
const tooFast = await postComment(store, {
  page: 'site', ip: '1.2.3.4', content: '追问', now: T0 + 5000,
});
assert.equal(tooFast.status, 429);

// 4. 同一 IP 冷却后无需再填昵称/邮箱，且忽略传入的新昵称
const second = await postComment(store, {
  page: 'essay-1', ip: '1.2.3.4', nickname: '换个名字', content: '追问', now: T0 + 60000,
});
assert.equal(second.status, 200);
assert.equal(second.body.comment.nickname, '小王', '同一 IP 必须沿用注册昵称');

// 5. 不同 IP 需要重新注册
const otherIpNoName = await postComment(store, {
  page: 'site', ip: '5.6.7.8', content: '你好', now: T0 + 60000,
});
assert.equal(otherIpNoName.status, 400);

// 6. GET：按页面过滤、最新在前、返回身份、无隐私字段
const sitePage = await getComments(store, { page: 'site', ip: '1.2.3.4' });
assert.equal(sitePage.status, 200);
assert.equal(sitePage.body.comments.length, 1);
assert.equal(sitePage.body.identity.nickname, '小王');
assert.equal(sitePage.body.identity.email, undefined);

const allPages = await getComments(store, { page: '', ip: '9.9.9.9' });
assert.equal(allPages.body.comments.length, 2);
assert.equal(allPages.body.identity, null);
assert.ok(allPages.body.comments[0].createdAt >= allPages.body.comments[1].createdAt);
for (const comment of allPages.body.comments) {
  assert.equal(comment.email, undefined);
  assert.equal(comment.ip, undefined);
}

// 7. 后台聚合：包含邮箱/IP/页面，供收件箱展示
const inbox = await listAllComments(store);
assert.equal(inbox.body.comments.length, 2);
assert.equal(inbox.body.comments[1].email, 'xiaowang@example.com');
assert.equal(inbox.body.comments[1].ip, '1.2.3.4');

// 8. 管理口令校验
assert.equal(checkAdminAuth('Bearer secret', 'secret').ok, true);
assert.equal(checkAdminAuth('Bearer wrong', 'secret').status, 401);
assert.equal(checkAdminAuth('', 'secret').status, 401);
assert.equal(checkAdminAuth('Bearer x', '').status, 503, '未配置口令时应提示配置');

// 9. 删除评论
const target = inbox.body.comments[0].id;
await removeComment(store, target);
assert.equal((await listAllComments(store)).body.comments.length, 1);

// 10. 内容超长截断、空内容拒绝
const empty = await postComment(store, { page: 'site', ip: '1.2.3.4', content: '   ', now: T0 + 120000 });
assert.equal(empty.status, 400);

const long = await postComment(store, {
  page: 'site', ip: '1.2.3.4', content: 'x'.repeat(5000), now: T0 + 180000,
});
assert.equal(long.status, 200);
assert.equal(long.body.comment.content.length, 2000);

// 11. 匿名 / 私密选项
const store2 = memoryStore();
const TA = Date.parse('2026-07-07T10:00:00Z');

const anon = await postComment(store2, {
  page: 'site', ip: '10.0.0.1', nickname: '真名', email: 'real@example.com',
  content: '匿名的公开留言', anonymous: true, now: TA,
});
assert.equal(anon.status, 200);
assert.equal(anon.body.comment.nickname, '匿名', '匿名留言对外显示为「匿名」');
assert.equal(anon.body.comment.anonymous, true);

const priv = await postComment(store2, {
  page: 'site', ip: '10.0.0.1', content: '只给站长看', visibility: 'private', now: TA + 60000,
});
assert.equal(priv.status, 200);
assert.equal(priv.body.comment.visibility, 'private');

// 公开列表：私密留言隐藏、匿名留言昵称为「匿名」
const pub = await getComments(store2, { page: 'site', ip: '9.9.9.9' });
assert.equal(pub.body.comments.length, 1, '私密留言不进公开列表');
assert.equal(pub.body.comments[0].nickname, '匿名');
assert.equal(pub.body.comments[0].content, '匿名的公开留言');

// 后台收件箱：两条都在，且能看到真实昵称与私密标记
const inbox2 = await listAllComments(store2);
assert.equal(inbox2.body.comments.length, 2);
const anonInInbox = inbox2.body.comments.find(c => c.content === '匿名的公开留言');
assert.equal(anonInInbox.nickname, '真名', '后台能看到匿名留言的真实昵称');
assert.equal(anonInInbox.anonymous, true);
const privInInbox = inbox2.body.comments.find(c => c.content === '只给站长看');
assert.equal(privInInbox.visibility, 'private');

// 默认（不传选项）为公开、非匿名
const plain = await postComment(store2, {
  page: 'site', ip: '10.0.0.2', nickname: '路人', email: 'passer@example.com',
  content: '默认留言', now: TA,
});
assert.equal(plain.body.comment.visibility, 'public');
assert.equal(plain.body.comment.anonymous, false);
assert.equal(plain.body.comment.nickname, '路人');

// 12. 站长切换公开/私密
const toPrivate = await setCommentVisibility(store2, anon.body.comment.id, 'private');
assert.equal(toPrivate.status, 200);
assert.equal(toPrivate.body.visibility, 'private');
const afterHide = await getComments(store2, { page: 'site', ip: '9.9.9.9' });
assert.ok(
  !afterHide.body.comments.some(c => c.content === '匿名的公开留言'),
  '站长改私密后应从公开列表消失',
);

const toPublic = await setCommentVisibility(store2, priv.body.comment.id, 'public');
assert.equal(toPublic.body.visibility, 'public');
const afterShow = await getComments(store2, { page: 'site', ip: '9.9.9.9' });
assert.ok(
  afterShow.body.comments.some(c => c.content === '只给站长看'),
  '站长改公开后应出现在公开列表',
);

assert.equal((await setCommentVisibility(store2, priv.body.comment.id, 'bad')).status, 400);
assert.equal((await setCommentVisibility(store2, 'no-such-id', 'public')).status, 404);

console.log('comments-api tests passed');
