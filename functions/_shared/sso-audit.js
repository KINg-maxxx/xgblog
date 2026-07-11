function traceIdFor(context) {
  const candidate = context.data?.traceId || context.request.headers.get('X-Trace-Id');
  if (typeof candidate === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(candidate)) return candidate;
  return crypto.randomUUID();
}

export function auditSsoEvent(context, config, event, status, reason) {
  const entry = {
    traceId: traceIdFor(context),
    clientId: config?.clientId || 'unknown',
    event,
    status,
    reason,
  };
  if (typeof context.data?.log === 'function') context.data.log(entry);
  else console.warn(JSON.stringify(entry));
}
