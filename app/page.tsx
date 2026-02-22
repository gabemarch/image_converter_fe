'use client';

import { useState, useCallback, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ConversionStatus from './components/ConversionStatus';
import DownloadButton from './components/DownloadButton';
import { ConversionState, InputFormat, OutputFormat } from './types/converter';
import { convertFile, uploadToBlob, convertFromUrl, detectInputFormat, getDefaultOutputFormat, getConversionCount, incrementConversionCount } from './lib/api';

type TabType = 'image' | 'ebook';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('image');
  const [uploadKey, setUploadKey] = useState(0);
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<OutputFormat>('png');
  const [totalConversions, setTotalConversions] = useState<number | null>(null);
  const [conversionState, setConversionState] = useState<ConversionState>({
    status: 'idle',
    file: null,
    convertedFile: null,
    error: null,
    progress: 0,
    uploadProgress: null,
  });

  useEffect(() => {
    getConversionCount().then(setTotalConversions);
  }, []);

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

    const outputFormat = (activeTab === 'image' ? selectedOutputFormat : getDefaultOutputFormat(inputFormat)) as OutputFormat;

    const totalBytes = file.size;
    setConversionState({
      status: 'uploading',
      file,
      convertedFile: null,
      error: null,
      progress: 0,
      uploadProgress: { loaded: 0, total: totalBytes },
      inputFormat,
      outputFormat,
    });

    try {
      const useBlobFlow = file.size > 4 * 1024 * 1024;
      if (useBlobFlow) {
        setConversionState(prev => ({ ...prev, status: 'uploading', uploadProgress: { loaded: 0, total: totalBytes } }));
        const { url } = await uploadToBlob(file);
        setConversionState(prev => ({ ...prev, status: 'processing', uploadProgress: null }));
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
        const newTotal = await incrementConversionCount();
        if (typeof newTotal === 'number') setTotalConversions(newTotal);
      } else {
        const convertedBlob = await convertFile(file, outputFormat, (loaded, total) => {
          const progress = total ? Math.round((loaded / total) * 100) : 0;
          const uploadComplete = total > 0 && loaded >= total;
          setConversionState(prev => ({
            ...prev,
            status: uploadComplete ? 'processing' : 'uploading',
            progress: uploadComplete ? 0 : progress,
            uploadProgress: uploadComplete ? null : { loaded, total },
          }));
        });
        setConversionState({
          status: 'success',
          file,
          convertedFile: convertedBlob,
          error: null,
          progress: 100,
          uploadProgress: null,
          inputFormat,
          outputFormat,
        });
        const newTotal = await incrementConversionCount();
        if (typeof newTotal === 'number') setTotalConversions(newTotal);
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
        uploadProgress: null,
        inputFormat,
        outputFormat,
      });
    }
  }, [activeTab, selectedOutputFormat]);

  const handleReset = useCallback(() => {
    setConversionState({
      status: 'idle',
      file: null,
      convertedFile: null,
      error: null,
      progress: 0,
      uploadProgress: null,
    });
    setUploadKey((k) => k + 1);
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
              FileConverterOnline
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {activeTab === 'image' 
                ? 'Convert your images between various formats'
                : 'Convert your ebooks to AZW3 format'
              }
            </p>
            {totalConversions !== null && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{totalConversions.toLocaleString()}</span>
                {' '}files converted in total
              </p>
            )}
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
              {activeTab === 'image' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Output format
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOutputFormat('png')}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${selectedOutputFormat === 'png'
                          ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-800'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }
                      `}
                    >
                      PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOutputFormat('jpg')}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${selectedOutputFormat === 'jpg'
                          ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-800'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }
                      `}
                    >
                      JPG
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Choose the format for your converted image
                  </p>
                </div>
              )}
              <div className="mb-6">
                <FileUpload
                  key={uploadKey}
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
