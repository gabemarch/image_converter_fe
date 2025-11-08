'use client';

import { ConversionState } from '../types/converter';

interface ConversionStatusProps {
  state: ConversionState;
}

export default function ConversionStatus({ state }: ConversionStatusProps) {
  const { status, error } = state;

  if (status === 'idle') {
    return null;
  }

  if (status === 'uploading' || status === 'processing') {
    return (
      <div className="w-full p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {status === 'uploading' ? 'Uploading file...' : 'Converting AVIF to PNG...'}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Please wait while we process your image
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="w-full p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <svg
              className="w-8 h-8 text-green-600 dark:text-green-400"
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
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              Conversion successful!
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Your PNG file is ready to download
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="w-full p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400 mt-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">
              Conversion failed
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

