export interface ConversionState {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  file: File | null;
  convertedFile: Blob | null;
  error: string | null;
  progress: number;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
}

export interface ConversionError {
  message: string;
  code?: string;
}

