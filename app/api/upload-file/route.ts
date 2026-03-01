import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import { signUploadToken } from '@/app/lib/upload-token';

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'image-converter-uploads');
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/x-canon-cr2',
  'application/octet-stream',
  'application/epub+zip',
  'application/x-mobipocket-ebook',
  'application/pdf',
]);

export async function POST(request: Request) {
  if (!process.env.UPLOAD_TOKEN_SECRET && !process.env.CRON_SECRET) {
    console.warn('UPLOAD_TOKEN_SECRET not set; using dev secret. Set it in production.');
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const type = file.type || 'application/octet-stream';
    if (!ALLOWED_TYPES.has(type) && !type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const id = randomBytes(16).toString('hex');
    const filePath = path.join(UPLOAD_DIR, id);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const expiry = Date.now() + TOKEN_TTL_MS;
    const token = signUploadToken(id, expiry);
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (request.headers.get('x-forwarded-proto') && request.headers.get('host')
        ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
        : 'http://localhost:3000');
    const url = `${base}/api/file/${id}?token=${token}`;

    return NextResponse.json({ url });
  } catch (e) {
    console.error('Upload file error:', e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
