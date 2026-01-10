/**
 * API client for communicating with the backend conversion service.
 */

import { OutputFormat } from '../types/converter';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://image-converter-be-stqy.vercel.app';
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760', 10);

/**
 * Detects the input format from a file.
 * @param file - The file to analyze
 * @returns The detected input format or null if unsupported
 */
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
  };
  
  return formatMap[extension] || null;
}

/**
 * Gets the default output format for an input format.
 * @param inputFormat - The input format
 * @returns The default output format
 */
export function getDefaultOutputFormat(inputFormat: string): OutputFormat {
  const defaults: Record<string, OutputFormat> = {
    'cr2': 'jpg',
    'avif': 'png',
    'webp': 'png',
    'epub': 'azw3',
    'mobi': 'azw3',
    'pdf': 'azw3',
  };
  
  return defaults[inputFormat] || 'png';
}

/**
 * Converts a file to the specified output format.
 * @param file - The file to convert
 * @param outputFormat - The desired output format (optional, will use default if not provided)
 * @returns Promise that resolves to the converted file Blob
 * @throws Error if conversion fails
 */
export async function convertFile(file: File, outputFormat?: OutputFormat): Promise<Blob> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Detect input format
  const inputFormat = detectInputFormat(file);
  if (!inputFormat) {
    throw new Error('Unsupported file type. Supported formats: CR2, AVIF, WebP, EPUB, MOBI, PDF');
  }

  // Use default output format if not provided
  const targetOutputFormat = outputFormat || getDefaultOutputFormat(inputFormat);

  // Create form data
  const formData = new FormData();
  formData.append('file', file);

  // Build URL with output format parameter
  const url = new URL(`${API_URL}/api/convert`);
  url.searchParams.append('output_format', targetOutputFormat);

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      // FastAPI returns errors with 'detail' field
      const errorData = await response.json().catch(() => ({ detail: 'Conversion failed' }));
      const errorMessage = errorData.detail || errorData.error || `Server error: ${response.status}`;
      throw new Error(errorMessage);
    }

    // Return the converted blob
    return await response.blob();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error. Please check your connection.');
  }
}

/**
 * Converts an AVIF file to PNG format (backward compatibility).
 * @param file - The AVIF file to convert
 * @returns Promise that resolves to the PNG Blob
 * @throws Error if conversion fails
 */
export async function convertAvifToPng(file: File): Promise<Blob> {
  return convertFile(file, 'png');
}

/**
 * Checks if the backend API is available.
 * @returns Promise that resolves to true if API is healthy
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

