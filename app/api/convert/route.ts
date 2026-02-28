import { NextResponse } from 'next/server';
import { getRequestIdentity, getIdentityId } from '@/app/lib/identity';
import { getUserPlan } from '@/app/lib/subscription';
import { assertWithinLimits, incrementUsage, UsageLimitError } from '@/app/lib/usage';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://image-converter-be-stqy.vercel.app';

export async function POST(request: Request) {
  const identity = await getRequestIdentity();
  const identityId = getIdentityId(identity);
  const plan = await getUserPlan(identityId);

  const url = new URL(request.url);
  const outputFormat = url.searchParams.get('output_format') || 'png';

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { detail: 'No file provided' },
      { status: 400 }
    );
  }

  try {
    await assertWithinLimits({
      identityId,
      plan,
      filesCount: 1,
      maxFileSizeBytes: file.size,
      fileSizes: [file.size],
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

  const backendUrl = `${BACKEND_URL}/api/convert?output_format=${encodeURIComponent(outputFormat)}`;
  const res = await fetch(backendUrl, {
    method: 'POST',
    body: formData,
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
