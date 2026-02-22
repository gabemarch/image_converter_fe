'use client';

import { useCallback, useState } from 'react';
import { FileInfo } from '../types/converter';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  maxSizeMB?: number;
  category?: 'image' | 'ebook';
}

export default function FileUpload({ 
  onFileSelect, 
  disabled = false,
  maxSizeMB = 10,
  category = 'image'
}: FileUploadProps) {
  const maxSizeMbForCr2 = 30;
  const [isDragging, setIsDragging] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    const extension = file.name.toLowerCase().split('.').pop() || '';
    
    const imageExtensions = ['cr2', 'avif', 'avifs', 'webp', 'heic', 'heif'];
    const ebookExtensions = ['epub', 'mobi', 'azw', 'pdf'];
    
    const supportedExtensions = category === 'image' ? imageExtensions : ebookExtensions;
    
    const isValidExtension = supportedExtensions.includes(extension) ||
      (category === 'image' && (
        file.type.includes('avif') ||
        file.type.includes('webp') ||
        file.type.includes('cr2') ||
        file.type.includes('heic') ||
        file.type.includes('heif')
      )) ||
      (category === 'ebook' && (
        file.type.includes('epub') ||
        file.type.includes('mobi') ||
        file.type.includes('pdf')
      ));
    
    if (!isValidExtension) {
      const formatList = category === 'image' 
        ? 'CR2, AVIF, WebP, HEIC' 
        : 'EPUB, MOBI, PDF';
      return `Unsupported file type. Supported ${category} formats: ${formatList}`;
    }

    const maxAllowedMb = category === 'image' && extension === 'cr2' ? maxSizeMbForCr2 : maxSizeMB;
    const maxSize = maxAllowedMb * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size exceeds maximum limit of ${maxAllowedMb}MB`;
    }

    if (file.size === 0) {
      return 'File is empty';
    }

    return null;
  }, [maxSizeMB, category, maxSizeMbForCr2]);

  const handleFile = useCallback((file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setFileInfo({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    onFileSelect(file);
  }, [onFileSelect, validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled, handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 transition-all
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <input
          type="file"
          id="file-upload"
          accept={category === 'image' 
            ? '.cr2,.avif,.avifs,.webp,.heic,.heif,image/avif,image/webp,image/heic,image/heif'
            : '.epub,.mobi,.azw,.pdf,application/epub+zip,application/x-mobipocket-ebook,application/pdf'
          }
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
        />
        
        <label
          htmlFor="file-upload"
          className={`
            flex flex-col items-center justify-center space-y-4
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex flex-col items-center space-y-2">
            <svg
              className="w-12 h-12 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {isDragging ? 'Drop your file here' : 'Drag & drop your file'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                or click to browse
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {category === 'image' 
                  ? 'Supports: CR2, AVIF, WebP, HEIC, HEIF'
                  : 'Supports: EPUB, MOBI, PDF'
                }
              </p>
            </div>
          </div>
          
          {fileInfo && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full max-w-md">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {fileInfo.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatFileSize(fileInfo.size)}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-green-500 flex-shrink-0 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
          )}
        </label>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
        {category === 'image'
          ? `Maximum file size: ${maxSizeMbForCr2}MB for CR2, ${maxSizeMB}MB for other images`
          : `Maximum file size: ${maxSizeMB}MB`
        }
      </p>
    </div>
  );
}

