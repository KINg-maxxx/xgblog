import { checkAdminAuth, removeComment, setCommentVisibility } from '../../_shared/comments-core.js';
import {
  corsPreflight,
  createKvStore,
  jsonResponse,
  missingKvResponse,
} from '../../_shared/kv-store.js';

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') return corsPreflight();
  if (request.method !== 'DELETE' && request.method !== 'PATCH') {
    return jsonResponse({ status: 405, body: { error: 'Method not allowed' } });
  }
  if (!env.COMMENTS) return missingKvResponse();

  const auth = checkAdminAuth(request.headers.get('Authorization'), env.COMMENTS_ADMIN_TOKEN);
  if (!auth.ok) return jsonResponse({ status: auth.status, body: { error: auth.error } });

  const store = createKvStore(env.COMMENTS);

  if (request.method === 'DELETE') {
    return jsonResponse(await removeComment(store, params.id));
  }

  // PATCH：站长切换公开/私密
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ status: 400, body: { error: '请求格式不正确。' } });
  }
  return jsonResponse(await setCommentVisibility(store, params.id, payload.visibility));
}
