import { NextResponse } from 'next/server';
import { getRequestIdentity, getIdentityId } from '@/app/lib/identity';
import { getUserPlan } from '@/app/lib/subscription';
import { assertWithinLimits, incrementUsage, UsageLimitError } from '@/app/lib/usage';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://image-converter-be-stqy.vercel.app';

function isInternalFileUrl(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith('/api/file/');
  } catch {
    return false;
  }
}

function resolveInternalFileUrl(url: string): string {
  const internalBase = process.env.INTERNAL_APP_URL;
  const publicBase = process.env.NEXT_PUBLIC_APP_URL;
  if (internalBase && publicBase && url.startsWith(publicBase)) {
    return url.replace(publicBase, internalBase.replace(/\/$/, ''));
  }
  return url;
}

export async function POST(request: Request) {
  const identity = await getRequestIdentity();
  const identityId = getIdentityId(identity);
  const plan = await getUserPlan(identityId);

  let body: { url?: string; filename?: string; output_format?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 });
  }

  const { url: fileUrl, filename, output_format = 'png' } = body;
  if (!fileUrl) {
    return NextResponse.json({ detail: 'Missing url' }, { status: 400 });
  }

  try {
    await assertWithinLimits({
      identityId,
      plan,
      filesCount: 1,
      maxFileSizeBytes: 0,
    });
  } catch (e) {
    if (e instanceof UsageLimitError) {
      return NextResponse.json(
        { detail: e.message, code: e.code },
        { status: 402 }
      );
    }
    throw e;
  }

  let res: Response;
  if (isInternalFileUrl(fileUrl)) {
    const resolvedUrl = resolveInternalFileUrl(fileUrl);
    const fileRes = await fetch(resolvedUrl);
    if (!fileRes.ok) {
      const err = await fileRes.json().catch(() => ({ error: 'Failed to fetch file' }));
      return NextResponse.json(
        { detail: err.error || err.detail || 'Failed to fetch file' },
        { status: fileRes.status }
      );
    }
    const buf = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const blob = new Blob([buf], { type: contentType });
    const formData = new FormData();
    const name = filename || 'file';
    const filePart =
      typeof File !== 'undefined'
        ? new (File as typeof globalThis.File)([blob], name, { type: blob.type })
        : blob;
    formData.append('file', filePart, name);
    res = await fetch(
      `${BACKEND_URL}/api/convert?output_format=${encodeURIComponent(output_format)}`,
      { method: 'POST', body: formData }
    );
  } else {
    res = await fetch(`${BACKEND_URL}/api/convert-from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: fileUrl,
        filename: filename ?? undefined,
        output_format,
      }),
    });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Conversion failed' }));
    return NextResponse.json(err, { status: res.status });
  }

  await incrementUsage(identityId, plan, 1);

  const blob = await res.blob();
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const contentDisposition = res.headers.get('content-disposition') || '';

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      ...(contentDisposition && { 'Content-Disposition': contentDisposition }),
    },
  });
}
