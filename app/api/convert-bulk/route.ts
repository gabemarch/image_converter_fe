import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getRequestIdentity, getIdentityId } from '@/app/lib/identity';
import { getUserPlan } from '@/app/lib/subscription';
import { assertWithinLimits, incrementUsage, UsageLimitError } from '@/app/lib/usage';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';


function outputFilename(filename: string, outputFormat: string): string {
  const stem = filename.replace(/\.[^.]+$/, '');
  return `${stem}.${outputFormat}`;
}

/** True if this URL is our self-hosted file (backend cannot reach localhost / internal URLs). */
function isInternalFileUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.startsWith('/api/file/');
  } catch {
    return false;
  }
}

/** Resolve internal file URL so server-side fetch hits same instance (avoids 404 when multi-replica). */
function resolveInternalFileUrl(url: string): string {
  const internalBase = process.env.INTERNAL_APP_URL;
  const publicBase = process.env.NEXT_PUBLIC_APP_URL;
  if (internalBase && publicBase && url.startsWith(publicBase)) {
    return url.replace(publicBase, internalBase.replace(/\/$/, ''));
  }
  return url;
}

/** Fetch file from our server and convert via backend /api/convert (multipart). */
async function convertInternalFile(
  fileUrl: string,
  filename: string,
  outputFormat: string
): Promise<Blob> {
  const resolvedUrl = resolveInternalFileUrl(fileUrl);

  const fileRes = await fetch(resolvedUrl);
  if (!fileRes.ok) {
    const err = await fileRes.json().catch(() => ({ error: 'Failed to fetch file' }));
    const msg = err.error || err.detail || `Failed to fetch file: ${fileRes.status}`;

    throw new Error(msg);
  }
  const buf = await fileRes.arrayBuffer();

  const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
  const blob = new Blob([buf], { type: contentType });
  const formData = new FormData();
  // Use File when available (Node 20+) so backend receives part with filename; else Blob + filename arg
  const filePart =
    typeof File !== 'undefined'
      ? new (File as typeof globalThis.File)([blob], filename, { type: blob.type })
      : blob;
  formData.append('file', filePart, filename);

  const backendConvertUrl = `${BACKEND_URL}/api/convert?output_format=${encodeURIComponent(outputFormat)}`;
  const res = await fetch(backendConvertUrl, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Conversion failed' }));
    const msg = err.detail || String(err);
    throw new Error(msg);
  }
  return res.blob();
}

export async function POST(request: Request) {

  const identity = await getRequestIdentity();
  const identityId = getIdentityId(identity);
  const plan = await getUserPlan(identityId);


  let body: { urls?: { url: string; filename: string }[]; output_format?: string };
  try {
    body = await request.json();
  } catch (e) {

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
      const name = outputFilename(filename || 'file', output_format);
      const internal = isInternalFileUrl(url);
      let blob: Blob;
      if (internal) {
        blob = await convertInternalFile(url, filename || 'file', output_format);
      } else {
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
        blob = await res.blob();
      }
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
      const errMsg = result.reason?.message ?? 'Conversion failed';
      failed.push({
        filename: item?.filename ?? `file ${i + 1}`,
        error: errMsg,
      });
    }
  });


  for (const { name, blob } of succeeded) {
    const buf = await blob.arrayBuffer();
    zip.file(name, buf);
  }

  if (succeeded.length === 0) {
    console.error('[convert-bulk] All conversions failed', { failures: failed });
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
