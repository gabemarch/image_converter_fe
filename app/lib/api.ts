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
 * Upload file to our server (Hetzner/self-hosted). Returns a signed URL the backend can fetch.
 * Used for large single-file and all bulk conversions.
 */
export async function uploadToServer(
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ url: string }> {
  const base = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/api/upload-file`);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { url?: string };
          if (data?.url) resolve({ url: data.url });
          else reject(new Error('Invalid upload response'));
        } catch {
          reject(new Error('Invalid upload response'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(err?.error ?? `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });
}

/** Use our API proxy so limits and usage are enforced server-side. */
const CONVERT_API = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL ?? '');

/**
 * Ask backend to convert a file at a public URL (used after uploadToServer for large files).
 */
export async function convertFromUrl(
  fileUrl: string,
  filename: string,
  outputFormat: OutputFormat
): Promise<Blob> {
  const base = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  const response = await fetch(`${base}/api/convert-from-url`, {
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
    const err = new Error(errorMessage) as Error & { code?: string };
    if (response.status === 402) err.code = errorData.code;
    throw err;
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

  // For files over body limit, upload to our server first then convert-from-url
  if (file.size > BLOB_THRESHOLD_BYTES) {
    const { url } = await uploadToServer(file, onUploadProgress);
    return convertFromUrl(url, file.name, targetOutputFormat);
  }

  const formData = new FormData();
  formData.append('file', file);

  const base = typeof window !== 'undefined' ? window.location.origin : CONVERT_API || 'http://localhost:3000';
  const url = new URL(`${base}/api/convert`);
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

/** Plan/entitlements from /api/me/plan (for UI gating and limits). */
export interface PlanResponse {
  plan: 'free' | 'starter' | 'pro';
  entitlements: {
    plan: string;
    adsEnabled: boolean;
    bulkEnabled: boolean;
    maxFilesPerJob: number;
    maxFileSizeBytes: number;
    maxFileSizeMB?: number;
    conversionsPerDay?: number;
    conversionsPerMonth?: number;
    priority: string;
  };
  usage: {
    dailyUsed: number;
    dailyLimit: number | null;
    monthlyUsed: number;
    monthlyLimit: number | null;
  };
  subscription: { status: string; currentPeriodEnd: number } | null;
}

/**
 * Fetches the current user's plan from the backend. The plan is Stripe-backed:
 * - Normal flow: user subscribes via checkout → Stripe webhooks hit /api/stripe/webhook →
 *   backend writes subscription to Redis (sub:{clerkUserId}). This API reads from Redis.
 * - Sync flow: if signed in but no subscription in Redis, GET /api/me/plan looks up Stripe
 *   by Clerk metadata (stripeCustomerId) or primary email, finds active subscription,
 *   writes to Redis, then returns starter/pro. So the plan always reflects Stripe.
 */
export async function getPlan(): Promise<PlanResponse> {
  const res = await fetch('/api/me/plan', { cache: 'no-store' });
  if (!res.ok) {
    return {
      plan: 'free',
      entitlements: {
        plan: 'free',
        adsEnabled: true,
        bulkEnabled: false,
        maxFilesPerJob: 1,
        maxFileSizeBytes: 10 * 1024 * 1024,
        maxFileSizeMB: 10,
        conversionsPerDay: 5,
        priority: 'standard',
      },
      usage: { dailyUsed: 0, dailyLimit: 5, monthlyUsed: 0, monthlyLimit: null },
      subscription: null,
    };
  }
  return res.json();
}

/**
 * Bulk convert: upload files to our server, then call convert-bulk API; returns zip Blob.
 */
export async function convertBulk(
  files: File[],
  outputFormat: OutputFormat,
  onFileProgress?: (fileIndex: number, loaded: number, total: number) => void
): Promise<Blob> {
  const base = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  const urls: { url: string; filename: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const { url } = await uploadToServer(file, (loaded, total) => onFileProgress?.(i, loaded, total));
    urls.push({ url, filename: file.name });
  }
  const res = await fetch(`${base}/api/convert-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, output_format: outputFormat }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: 'Bulk conversion failed' }));
    let msg = data.detail || data.error || `Server error: ${res.status}`;
    if (Array.isArray(data.failures) && data.failures.length > 0) {
      const first = data.failures[0] as { filename?: string; error?: string };
      msg += ` (e.g. ${first.filename ?? 'file'}: ${first.error ?? 'unknown'})`;
    }
    const err = new Error(msg) as Error & { code?: string };
    if (res.status === 402) err.code = data.code;
    throw err;
  }
  return res.blob();
}

