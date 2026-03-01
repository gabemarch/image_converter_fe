import { NextResponse } from 'next/server';
import { createReadStream, unlink } from 'fs';
import { Readable } from 'stream';
import path from 'path';
import os from 'os';
import { verifyUploadToken } from '@/app/lib/upload-token';

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'image-converter-uploads');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get('token');

  if (!id || !token || !verifyUploadToken(id, token)) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 });
  }

  const safeId = path.normalize(id).replace(/^(\.\.(\/|\\|$))+/, '');
  if (safeId !== id) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const filePath = path.join(UPLOAD_DIR, id);
  const resolved = path.resolve(UPLOAD_DIR, id);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const nodeStream = createReadStream(filePath);
    nodeStream.once('error', () => {
      unlink(filePath, () => {});
    });
    nodeStream.once('end', () => {
      unlink(filePath, () => {});
    });

    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Cache-Control', 'no-store');

    return new NextResponse(webStream, { status: 200, headers });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found or already consumed' }, { status: 404 });
    }
    console.error('File serve error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
