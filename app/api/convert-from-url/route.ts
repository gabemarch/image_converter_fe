import { NextResponse } from 'next/server';
import { getRequestIdentity, getIdentityId } from '@/app/lib/identity';
import { getUserPlan } from '@/app/lib/subscription';
import { assertWithinLimits, incrementUsage, UsageLimitError } from '@/app/lib/usage';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://image-converter-be-stqy.vercel.app';

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

  const { url: fileUrl, filename, output_format } = body;
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

  const res = await fetch(`${BACKEND_URL}/api/convert-from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: fileUrl,
      filename: filename ?? undefined,
      output_format: output_format ?? 'png',
    }),
  });

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
