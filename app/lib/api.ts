import { OutputFormat } from '../types/converter';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://image-converter-be-stqy.vercel.app';
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760', 10);
const MAX_FILE_SIZE_CR2 = 30 * 1024 * 1024; // 30MB for CR2 files

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

export async function convertFile(file: File, outputFormat?: OutputFormat): Promise<Blob> {
  const inputFormat = detectInputFormat(file);
  if (!inputFormat) {
    throw new Error('Unsupported file type. Supported formats: CR2, AVIF, WebP, EPUB, MOBI, PDF, HEIC, HEIF');
  }

  const maxSizeForFile = inputFormat === 'cr2' ? MAX_FILE_SIZE_CR2 : MAX_FILE_SIZE;
  if (file.size > maxSizeForFile) {
    throw new Error(`File size exceeds maximum limit of ${Math.round(maxSizeForFile / 1024 / 1024)}MB`);
  }

  const targetOutputFormat = outputFormat || getDefaultOutputFormat(inputFormat);

  const formData = new FormData();
  formData.append('file', file);

  const url = new URL(`${API_URL}/api/convert`);
  url.searchParams.append('output_format', targetOutputFormat);

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Conversion failed' }));
      const errorMessage = errorData.detail || errorData.error || `Server error: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error. Please check your connection.');
  }
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

