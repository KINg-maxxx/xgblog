import { CompactEncrypt, base64url, compactDecrypt } from 'jose';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encryptionKey(value) {
  const key = base64url.decode(String(value || ''));
  if (key.length !== 32) throw new Error('Invalid cookie key');
  return key;
}

export async function sealCookie(payload, key) {
  return new CompactEncrypt(encoder.encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .encrypt(encryptionKey(key));
}

export async function unsealCookie(value, key) {
  const { plaintext } = await compactDecrypt(value, encryptionKey(key));
  return JSON.parse(decoder.decode(plaintext));
}

export function readCookie(request, name) {
  const prefix = `${name}=`;
  for (const part of (request.headers.get('Cookie') || '').split(/;\s*/)) {
    if (part.startsWith(prefix)) return part.slice(prefix.length);
  }
  return '';
}

export function secureCookie(name, value, maxAge) {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearCookie(name) {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
