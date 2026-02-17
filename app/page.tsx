'use client';

import { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import ConversionStatus from './components/ConversionStatus';
import DownloadButton from './components/DownloadButton';
import { ConversionState, InputFormat, OutputFormat } from './types/converter';
import { convertFile, uploadToBlob, convertFromUrl, detectInputFormat, getDefaultOutputFormat } from './lib/api';

type TabType = 'image' | 'ebook';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('image');
  const [conversionState, setConversionState] = useState<ConversionState>({
    status: 'idle',
    file: null,
    convertedFile: null,
    error: null,
    progress: 0,
  });

  const handleFileSelect = useCallback(async (file: File) => {
    const inputFormat = detectInputFormat(file) as InputFormat | null;
    if (!inputFormat) {
      setConversionState({
        status: 'error',
        file,
        convertedFile: null,
        error: 'Unsupported file type',
        progress: 0,
      });
      return;
    }

    // Validate that the file matches the active tab
    const imageFormats: InputFormat[] = ['cr2', 'avif', 'webp', 'heic', 'heif'];
    const ebookFormats: InputFormat[] = ['epub', 'mobi', 'pdf'];
    
    const isImageFormat = imageFormats.includes(inputFormat);
    const isEbookFormat = ebookFormats.includes(inputFormat);
    
    if ((activeTab === 'image' && !isImageFormat) || (activeTab === 'ebook' && !isEbookFormat)) {
      setConversionState({
        status: 'error',
        file,
        convertedFile: null,
        error: `Please select a ${activeTab === 'image' ? 'image' : 'ebook'} file for this tab`,
        progress: 0,
      });
      return;
    }

    const outputFormat = getDefaultOutputFormat(inputFormat) as OutputFormat;

    setConversionState({
      status: 'uploading',
      file,
      convertedFile: null,
      error: null,
      progress: 0,
      inputFormat,
      outputFormat,
    });

    try {
      // For large files (>4MB), upload to Vercel Blob first so we avoid 413; then convert-from-url
      const useBlobFlow = file.size > 4 * 1024 * 1024;
      if (useBlobFlow) {
        setConversionState(prev => ({ ...prev, status: 'uploading' }));
        const { url } = await uploadToBlob(file);
        setConversionState(prev => ({ ...prev, status: 'processing' }));
        const convertedBlob = await convertFromUrl(url, file.name, outputFormat);
        setConversionState({
          status: 'success',
          file,
          convertedFile: convertedBlob,
          error: null,
          progress: 100,
          inputFormat,
          outputFormat,
        });
      } else {
        setConversionState(prev => ({ ...prev, status: 'processing' }));
        const convertedBlob = await convertFile(file, outputFormat);
        setConversionState({
          status: 'success',
          file,
          convertedFile: convertedBlob,
          error: null,
          progress: 100,
          inputFormat,
          outputFormat,
        });
      }
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
        inputFormat,
        outputFormat,
      });
    }
  }, [activeTab]);

  const handleReset = useCallback(() => {
    setConversionState({
      status: 'idle',
      file: null,
      convertedFile: null,
      error: null,
      progress: 0,
    });
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    // Reset conversion state when switching tabs
    setConversionState({
      status: 'idle',
      file: null,
      convertedFile: null,
      error: null,
      progress: 0,
    });
  }, []);

  const getDownloadFilename = (): string => {
    if (!conversionState.file || !conversionState.outputFormat) {
      return 'converted';
    }
    const originalName = conversionState.file.name.replace(/\.[^.]+$/, '');
    return `${originalName}.${conversionState.outputFormat}`;
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {activeTab === 'image' ? 'Image Converter' : 'Ebook Converter'}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {activeTab === 'image' 
                ? 'Convert your images between various formats'
                : 'Convert your ebooks to AZW3 format'
              }
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="flex">
                <button
                  onClick={() => handleTabChange('image')}
                  className={`
                    flex-1 px-6 py-4 text-sm font-medium transition-colors
                    ${activeTab === 'image'
                      ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }
                  `}
                >
                  Image
                </button>
                {/* <button
                  onClick={() => handleTabChange('ebook')}
                  className={`
                    flex-1 px-6 py-4 text-sm font-medium transition-colors
                    ${activeTab === 'ebook'
                      ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }
                  `}
                >
                  Ebook
                </button> */}
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-6">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  disabled={conversionState.status === 'uploading' || conversionState.status === 'processing'}
                  category={activeTab}
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
                  <p className="font-medium">Upload File</p>
                  <p className="text-xs mt-1">Drag & drop or click to browse</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
                  </div>
                  <p className="font-medium">Convert</p>
                  <p className="text-xs mt-1">Automatic format conversion</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
                  </div>
                  <p className="font-medium">Download</p>
                  <p className="text-xs mt-1">Get your converted file</p>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Supported Conversions
                </h3>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {activeTab === 'image' ? (
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>CR2 → JPG, PNG</li>
                      <li>AVIF → JPG, PNG</li>
                      <li>WebP → JPG, PNG</li>
                      <li>HEIC/HEIF → JPG, PNG</li>
                    </ul>
                  ) : (
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>EPUB → AZW3</li>
                      <li>MOBI → AZW3</li>
                      <li>PDF → AZW3</li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Free file conversion • No file storage • Privacy guaranteed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
