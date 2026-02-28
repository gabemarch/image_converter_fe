import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getRequestIdentity, getIdentityId } from '@/app/lib/identity';
import { getUserPlan } from '@/app/lib/subscription';
import { assertWithinLimits, incrementUsage, UsageLimitError } from '@/app/lib/usage';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://image-converter-be-stqy.vercel.app';

function outputFilename(filename: string, outputFormat: string): string {
  const stem = filename.replace(/\.[^.]+$/, '');
  return `${stem}.${outputFormat}`;
}

export async function POST(request: Request) {
  const identity = await getRequestIdentity();
  const identityId = getIdentityId(identity);
  const plan = await getUserPlan(identityId);

  let body: { urls?: { url: string; filename: string }[]; output_format?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 });
  }

  const { urls = [], output_format = 'png' } = body;
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ detail: 'Provide at least one url with filename' }, { status: 400 });
  }

  try {
    await assertWithinLimits({
      identityId,
      plan,
      filesCount: urls.length,
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

  const zip = new JSZip();

  const results = await Promise.allSettled(
    urls.map(async ({ url, filename }) => {
      const res = await fetch(`${BACKEND_URL}/api/convert-from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          filename: filename || undefined,
          output_format,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Conversion failed' }));
        throw new Error(err.detail || String(err));
      }
      const blob = await res.blob();
      const name = outputFilename(filename || 'file', output_format);
      return { name, blob };
    })
  );

  const succeeded: { name: string; blob: Blob }[] = [];
  const failed: { filename: string; error: string }[] = [];

  results.forEach((result, i) => {
    const item = urls[i];
    if (result.status === 'fulfilled') {
      succeeded.push(result.value);
    } else {
      failed.push({
        filename: item?.filename ?? `file ${i + 1}`,
        error: result.reason?.message ?? 'Conversion failed',
      });
    }
  });

  for (const { name, blob } of succeeded) {
    zip.file(name, blob);
  }

  if (succeeded.length === 0) {
    return NextResponse.json(
      { detail: 'All conversions failed', failures: failed },
      { status: 500 }
    );
  }

  await incrementUsage(identityId, plan, succeeded.length);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipBuffer = await zipBlob.arrayBuffer();

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="converted-files.zip"',
    },
  });
}
