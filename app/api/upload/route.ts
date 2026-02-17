import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

/**
 * Client upload handler for Vercel Blob.
 * Used for files > 4.5MB so the browser uploads directly to Blob (bypassing serverless body limit),
 * then the app calls the backend convert-from-url with the blob URL.
 * @see https://vercel.com/docs/vercel-blob/client-upload
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: [
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
          ],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Optional: run logic after upload (e.g. logging). Conversion is triggered by the client via convert-from-url.
        console.log('Blob upload completed:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
