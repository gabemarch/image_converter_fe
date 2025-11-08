'use client';

import { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import ConversionStatus from './components/ConversionStatus';
import DownloadButton from './components/DownloadButton';
import { ConversionState } from './types/converter';
import { convertAvifToPng } from './lib/api';

export default function Home() {
  const [conversionState, setConversionState] = useState<ConversionState>({
    status: 'idle',
    file: null,
    convertedFile: null,
    error: null,
    progress: 0,
  });

  const handleFileSelect = useCallback(async (file: File) => {
    setConversionState({
      status: 'uploading',
      file,
      convertedFile: null,
      error: null,
      progress: 0,
    });

    try {
      setConversionState(prev => ({ ...prev, status: 'processing' }));
      
      const convertedBlob = await convertAvifToPng(file);

      const originalName = file.name.replace(/\.(avif|avifs)$/i, '');
      
      setConversionState({
        status: 'success',
        file,
        convertedFile: convertedBlob,
        error: null,
        progress: 100,
      });
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred during conversion';
      
      setConversionState({
        status: 'error',
        file,
        convertedFile: null,
        error: errorMessage,
        progress: 0,
      });
    }
  }, []);

  const handleReset = useCallback(() => {
    setConversionState({
      status: 'idle',
      file: null,
      convertedFile: null,
      error: null,
      progress: 0,
    });
  }, []);

  const getDownloadFilename = (): string => {
    if (!conversionState.file) return 'converted.png';
    const originalName = conversionState.file.name.replace(/\.(avif|avifs)$/i, '');
    return `${originalName}.png`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              AVIF to PNG Converter
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Convert your AVIF images to PNG format quickly and easily
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 sm:p-8">
            <div className="mb-6">
              <FileUpload
                onFileSelect={handleFileSelect}
                disabled={conversionState.status === 'uploading' || conversionState.status === 'processing'}
              />
            </div>

            {conversionState.status !== 'idle' && (
              <div className="mb-6">
                <ConversionStatus state={conversionState} />
              </div>
            )}

            {conversionState.status === 'success' && conversionState.convertedFile && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <DownloadButton
                  file={conversionState.convertedFile}
                  filename={getDownloadFilename()}
                />
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg font-medium border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Convert Another File
                </button>
              </div>
            )}

            {conversionState.status === 'error' && (
              <div className="flex justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 rounded-lg font-medium border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                How it works
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                  </div>
                  <p className="font-medium">Upload AVIF</p>
                  <p className="text-xs mt-1">Drag & drop or click to browse</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
                  </div>
                  <p className="font-medium">Convert</p>
                  <p className="text-xs mt-1">Automatic conversion to PNG</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
                  </div>
                  <p className="font-medium">Download</p>
                  <p className="text-xs mt-1">Get your PNG file</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Free AVIF to PNG conversion • No file storage • Privacy guaranteed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
