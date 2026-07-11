import { checkAdminAuth, listAllComments } from '../../_shared/comments-core.js';
import {
  corsPreflight,
  createKvStore,
  jsonResponse,
  missingKvResponse,
} from '../../_shared/kv-store.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return corsPreflight();
  if (request.method !== 'GET') {
    return jsonResponse({ status: 405, body: { error: 'Method not allowed' } });
  }
  if (!env.COMMENTS) return missingKvResponse();

  const auth = checkAdminAuth(request.headers.get('Authorization'), env.COMMENTS_ADMIN_TOKEN);
  if (!auth.ok) return jsonResponse({ status: auth.status, body: { error: auth.error } });

  return jsonResponse(await listAllComments(createKvStore(env.COMMENTS)));
}
