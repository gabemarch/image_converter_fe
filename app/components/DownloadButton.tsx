'use client';

interface DownloadButtonProps {
  file: Blob;
  filename: string;
  disabled?: boolean;
}

export default function DownloadButton({ 
  file, 
  filename, 
  disabled = false 
}: DownloadButtonProps) {
  const handleDownload = () => {
    if (disabled) return;

    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getButtonText = (): string => {
    const extension = filename.split('.').pop()?.toUpperCase() || '';
    return `Download ${extension}`;
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled}
      className={`
        w-full sm:w-auto px-6 py-3 rounded-lg font-medium
        transition-all duration-200
        flex items-center justify-center space-x-2
        ${
          disabled
            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
        }
      `}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      <span>{getButtonText()}</span>
    </button>
  );
}

