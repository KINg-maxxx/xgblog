import { getComments, postComment } from '../_shared/comments-core.js';
import {
  clientIp,
  corsPreflight,
  createKvStore,
  jsonResponse,
  missingKvResponse,
} from '../_shared/kv-store.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return corsPreflight();
  if (!env.COMMENTS) return missingKvResponse();

  const store = createKvStore(env.COMMENTS);
  const ip = clientIp(request);

  if (request.method === 'GET') {
    const page = new URL(request.url).searchParams.get('page') || '';
    return jsonResponse(await getComments(store, { page, ip }));
  }

  if (request.method === 'POST') {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ status: 400, body: { error: '请求格式不正确。' } });
    }
    return jsonResponse(await postComment(store, {
      page: payload.page,
      nickname: payload.nickname,
      email: payload.email,
      content: payload.content,
      visibility: payload.visibility,
      anonymous: payload.anonymous,
      ip,
    }));
  }

  return jsonResponse({ status: 405, body: { error: 'Method not allowed' } });
}
