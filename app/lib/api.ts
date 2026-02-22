import { upload } from '@vercel/blob/client';
import { OutputFormat } from '../types/converter';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://image-converter-be-stqy.vercel.app';
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760', 10);
const MAX_FILE_SIZE_CR2 = 30 * 1024 * 1024; // 30MB for CR2 files
/** Vercel serverless body limit; use Blob + convert-from-url above this. */
const BLOB_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4MB

export function detectInputFormat(file: File): string | null {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  
  const formatMap: Record<string, string> = {
    'cr2': 'cr2',
    'avif': 'avif',
    'avifs': 'avif',
    'webp': 'webp',
    'epub': 'epub',
    'mobi': 'mobi',
    'azw': 'mobi',
    'pdf': 'pdf',
    'heic': 'heic',
    'heif': 'heif',
  };
  
  return formatMap[extension] || null;
}

export function getDefaultOutputFormat(inputFormat: string): OutputFormat {
  const defaults: Record<string, OutputFormat> = {
    'cr2': 'jpg',
    'avif': 'png',
    'webp': 'png',
    'epub': 'azw3',
    'mobi': 'azw3',
    'pdf': 'azw3',
    'heic': 'jpg',
    'heif': 'jpg',
  };
  
  return defaults[inputFormat] || 'png';
}

/**
 * Upload file to Vercel Blob (client → Blob directly, bypasses 4.5MB serverless limit).
 * @see https://vercel.com/docs/vercel-blob/client-upload
 */
export async function uploadToBlob(file: File): Promise<{ url: string }> {
  const blob = await upload(file.name, file, {
    access: 'public',
    handleUploadUrl: '/api/upload',
  });
  return { url: blob.url };
}

/**
 * Ask backend to convert a file at a public URL (used after uploadToBlob for large files).
 */
export async function convertFromUrl(
  fileUrl: string,
  filename: string,
  outputFormat: OutputFormat
): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/convert-from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: fileUrl,
      filename,
      output_format: outputFormat,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Conversion failed' }));
    const errorMessage = errorData.detail || errorData.error || `Server error: ${response.status}`;
    throw new Error(errorMessage);
  }

  return await response.blob();
}

/**
 * Format bytes as "X.XX MB" or "X.XX KB".
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function convertFile(
  file: File,
  outputFormat?: OutputFormat,
  onUploadProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  const inputFormat = detectInputFormat(file);
  if (!inputFormat) {
    throw new Error('Unsupported file type. Supported formats: CR2, AVIF, WebP, EPUB, MOBI, PDF, HEIC, HEIF');
  }

  const maxSizeForFile = inputFormat === 'cr2' ? MAX_FILE_SIZE_CR2 : MAX_FILE_SIZE;
  if (file.size > maxSizeForFile) {
    throw new Error(`File size exceeds maximum limit of ${Math.round(maxSizeForFile / 1024 / 1024)}MB`);
  }

  const targetOutputFormat = outputFormat || getDefaultOutputFormat(inputFormat);

  // For files over Vercel's body limit, upload to Blob first then convert-from-url (no upload progress from Blob client)
  if (file.size > BLOB_THRESHOLD_BYTES) {
    const { url } = await uploadToBlob(file);
    return convertFromUrl(url, file.name, targetOutputFormat);
  }

  const formData = new FormData();
  formData.append('file', file);

  const url = new URL(`${API_URL}/api/convert`);
  url.searchParams.append('output_format', targetOutputFormat);

  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onUploadProgress) {
        onUploadProgress(e.loaded, e.total);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as Blob);
        return;
      }
      const resp = xhr.response as Blob | undefined;
      if (resp?.text) {
        resp.text().then((text: string) => {
          try {
            const data = JSON.parse(text);
            reject(new Error(data.detail || data.error || `Server error: ${xhr.status}`));
          } catch {
            reject(new Error(`Server error: ${xhr.status}`));
          }
        }).catch(() => reject(new Error(`Server error: ${xhr.status}`)));
      } else {
        reject(new Error(`Server error: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error. Please check your connection.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')));

    xhr.open('POST', url.toString());
    xhr.send(formData);
  });
}

export async function convertAvifToPng(file: File): Promise<Blob> {
  return convertFile(file, 'png');
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function getConversionCount(): Promise<number> {
  try {
    const response = await fetch('/api/stats', { cache: 'no-store' });
    if (!response.ok) return 0;
    const data = await response.json();
    return typeof data.totalConversions === 'number' ? data.totalConversions : 0;
  } catch {
    return 0;
  }
}

export async function incrementConversionCount(): Promise<number> {
  try {
    const response = await fetch('/api/stats/increment', { method: 'POST' });
    if (!response.ok) return 0;
    const data = await response.json();
    return typeof data.totalConversions === 'number' ? data.totalConversions : 0;
  } catch {
    return 0;
  }
}

