/**
 * API client for communicating with the backend conversion service.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760', 10);

/**
 * Converts an AVIF file to PNG format.
 * @param file - The AVIF file to convert
 * @returns Promise that resolves to the PNG Blob
 * @throws Error if conversion fails
 */
export async function convertAvifToPng(file: File): Promise<Blob> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Validate file type
  if (!file.type.includes('avif') && !file.name.toLowerCase().endsWith('.avif')) {
    throw new Error('Invalid file type. Please upload an AVIF file.');
  }

  // Create form data
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_URL}/api/convert`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      // FastAPI returns errors with 'detail' field
      const errorData = await response.json().catch(() => ({ detail: 'Conversion failed' }));
      const errorMessage = errorData.detail || errorData.error || `Server error: ${response.status}`;
      throw new Error(errorMessage);
    }

    // Return the PNG blob
    return await response.blob();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error. Please check your connection.');
  }
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

