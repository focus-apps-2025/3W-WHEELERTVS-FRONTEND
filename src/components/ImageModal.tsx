import React, { useState } from 'react';
import { X, Loader, Download } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

export default function ImageModal({ isOpen, imageUrl, onClose }: ImageModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `image-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Image Preview</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Download image"
            >
              <Download className="w-6 h-6" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 dark:bg-gray-800">
          {isLoading && !hasError && (
            <div className="text-center space-y-3">
              <Loader className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
              <p className="text-gray-600 dark:text-gray-400 text-sm">Loading image...</p>
            </div>
          )}

          {hasError ? (
            <div className="text-center space-y-4 p-6">
              <div className="text-red-500 font-medium">Unable to load image</div>
              <p className="text-gray-600 dark:text-gray-400 text-sm max-w-sm">
                The image could not be loaded. Please try again.
              </p>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
