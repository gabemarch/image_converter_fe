'use client';

import { useState, useCallback } from 'react';
import { OutputFormat } from '../types/converter';
import { convertBulk, formatBytes } from '../lib/api';

const IMAGE_EXTENSIONS = ['cr2', 'avif', 'avifs', 'webp', 'heic', 'heif'];

interface BulkUploadProps {
  maxFilesPerJob: number;
  maxSizeMB: number;
  bulkEnabled: boolean;
  onLimitError?: () => void;
}

export default function BulkUpload({
  maxFilesPerJob,
  maxSizeMB,
  bulkEnabled,
  onLimitError,
}: BulkUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'converting' | 'success' | 'error'>('idle');
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      return `Unsupported: ${file.name}. Use CR2, AVIF, WebP, HEIC.`;
    }
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `${file.name}: max ${maxSizeMB} MB`;
    }
    return null;
  }, [maxSizeMB]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    const next: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const err = validateFile(file);
      if (err) {
        setError(err);
        return;
      }
      next.push(file);
    }
    if (files.length + next.length > maxFilesPerJob) {
      setError(`Maximum ${maxFilesPerJob} files per job.`);
      return;
    }
    setFiles((prev) => [...prev, ...next].slice(0, maxFilesPerJob));
    setError(null);
    e.target.value = '';
  }, [files.length, maxFilesPerJob, validateFile]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;
    setError(null);
    setStatus('uploading');
    try {
      setStatus('converting');
      const zip = await convertBulk(files, outputFormat);
      setZipBlob(zip);
      setStatus('success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bulk conversion failed';
      setError(msg);
      setStatus('error');
      if (e instanceof Error && (e as Error & { code?: string }).code === 'BULK_NOT_ALLOWED') {
        onLimitError?.();
      }
    }
  }, [files, outputFormat, onLimitError]);

  const handleDownloadZip = useCallback(() => {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-files.zip';
    a.click();
    URL.revokeObjectURL(url);
  }, [zipBlob]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setZipBlob(null);
    setStatus('idle');
    setError(null);
  }, []);

  if (!bulkEnabled) {
    return (
      <div className="w-full p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex flex-col items-center justify-center text-center py-6">
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Bulk convert</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-sm">
            Convert up to {maxFilesPerJob} files at once. Available on Starter and Pro.
          </p>
          <a
            href="#pricing"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Upgrade to unlock
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Output format
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOutputFormat('png')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${outputFormat === 'png' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            PNG
          </button>
          <button
            type="button"
            onClick={() => setOutputFormat('jpg')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${outputFormat === 'jpg' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            JPG
          </button>
        </div>
      </div>

      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
        <input
          type="file"
          multiple
          accept=".cr2,.avif,.avifs,.webp,.heic,.heif,image/avif,image/webp,image/heic,image/heif"
          onChange={handleFileInput}
          disabled={status === 'uploading' || status === 'converting'}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/20 dark:file:text-blue-300"
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Up to {maxFilesPerJob} files, max {maxSizeMB} MB each. CR2, AVIF, WebP, HEIC.
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2 max-h-40 overflow-y-auto">
          {files.map((file, i) => (
            <li key={i} className="flex items-center justify-between text-sm bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
              <span className="truncate text-gray-900 dark:text-gray-100">{file.name}</span>
              <span className="text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                disabled={status === 'uploading' || status === 'converting'}
                className="text-red-600 hover:text-red-700 dark:text-red-400 text-xs font-medium flex-shrink-0 ml-2"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {(status === 'uploading' || status === 'converting') && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {status === 'uploading' ? 'Uploading…' : 'Converting…'} {files.length} file(s)
          </p>
        </div>
      )}

      {status === 'success' && zipBlob && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm text-green-900 dark:text-green-100">Conversion complete.</p>
          <button
            type="button"
            onClick={handleDownloadZip}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
          >
            Download ZIP
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Convert more
          </button>
        </div>
      )}

      {status === 'error' && error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => { setStatus('idle'); setError(null); }}
            className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {files.length > 0 && status === 'idle' && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleConvert}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Convert {files.length} file{files.length !== 1 ? 's' : ''}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
