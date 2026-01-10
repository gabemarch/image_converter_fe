export type InputFormat = 'cr2' | 'avif' | 'webp' | 'epub' | 'mobi' | 'pdf';
export type OutputFormat = 'jpg' | 'png' | 'azw3';

export interface ConversionState {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  file: File | null;
  convertedFile: Blob | null;
  error: string | null;
  progress: number;
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

