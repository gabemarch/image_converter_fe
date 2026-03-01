import { createHmac } from 'crypto';

const TOKEN_SECRET =
  process.env.UPLOAD_TOKEN_SECRET || process.env.CRON_SECRET || 'dev-upload-secret';

export function signUploadToken(id: string, expiry: number): string {
  const payload = `${id}|${expiry}`;
  const sig = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifyUploadToken(id: string, token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  let payload: string;
  try {
    payload = Buffer.from(parts[0], 'base64url').toString('utf8');
  } catch {
    return false;
  }
  const [tokenId, expStr] = payload.split('|');
  if (tokenId !== id) return false;
  const expiry = parseInt(expStr, 10);
  if (Number.isNaN(expiry) || Date.now() > expiry) return false;
  const expected = signUploadToken(id, expiry);
  return token === expected;
}
