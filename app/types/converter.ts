export type InputFormat = 'cr2' | 'avif' | 'webp' | 'heic' | 'heif' | 'epub' | 'mobi' | 'pdf';
export type OutputFormat = 'jpg' | 'png' | 'azw3';

export interface UploadProgress {
  loaded: number;
  total: number;
}

export interface ConversionState {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  file: File | null;
  convertedFile: Blob | null;
  error: string | null;
  progress: number;
  /** When status is 'uploading', reports bytes sent and total for progress bar (X MB of Y MB). */
  uploadProgress?: UploadProgress | null;
  inputFormat?: InputFormat;
  outputFormat?: OutputFormat;
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

export interface SupportedConversion {
  input: InputFormat;
  outputs: OutputFormat[];
  defaultOutput: OutputFormat;
  category: 'image' | 'ebook';
}

