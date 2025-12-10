import React, { useState } from "react";
import { X, Loader, Image as ImageIcon, ExternalLink } from "lucide-react";
import { isGoogleDriveUrl } from "../utils/answerTemplateUtils";

interface ImagePreviewGridProps {
  images: Array<{
    questionId: string;
    questionText: string;
    url: string;
    isConverted?: boolean;
  }>;
}

const getGoogleDriveViewUrl = (url: string): string => {
  const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://drive.google.com/file/d/${fileIdMatch[1]}/view`;
  }
  return url;
};

const ImagePreviewGrid: React.FC<ImagePreviewGridProps> = ({ images }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (url: string) => {
    setLoadedImages((prev) => new Set(prev).add(url));
  };

  const handleImageError = (url: string) => {
    setFailedImages((prev) => new Set(prev).add(url));
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No images to preview</p>
      </div>
    );
  }

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;

  return (
    <div className="space-y-4">
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gray-100 dark:bg-gray-800 px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {selectedImage.questionText}
              </h3>
              <button
                onClick={() => setSelectedIndex(null)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-black p-4">
              {isGoogleDriveUrl(selectedImage.url) ? (
                <div className="flex flex-col items-center gap-4 text-white">
                  <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-gray-800 border-2 border-gray-600">
                    <ImageIcon className="w-10 h-10 text-gray-400" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium">Google Drive Image</p>
                    <p className="text-xs text-gray-300">
                      This image will be automatically converted to Cloudinary when you submit
                    </p>
                  </div>
                  <button
                    onClick={() => window.open(getGoogleDriveViewUrl(selectedImage.url), '_blank')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Google Drive
                  </button>
                </div>
              ) : (
                <img
                  src={selectedImage.url}
                  alt={selectedImage.questionText}
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 px-6 py-3 text-xs text-gray-600 dark:text-gray-400 truncate border-t border-gray-200 dark:border-gray-700">
              {selectedImage.url}
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex items-center justify-between">
              <button
                onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                disabled={selectedIndex === 0}
                className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedIndex + 1} / {images.length}
              </span>
              <button
                onClick={() => setSelectedIndex(Math.min(images.length - 1, selectedIndex + 1))}
                disabled={selectedIndex === images.length - 1}
                className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((image, index) => {
          const isGoogleDrive = isGoogleDriveUrl(image.url);
          const isLoading = !isGoogleDrive && !loadedImages.has(image.url) && !failedImages.has(image.url);
          const isFailed = !isGoogleDrive && failedImages.has(image.url);

          return (
            <button
              key={image.questionId}
              onClick={() => setSelectedIndex(index)}
              className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group"
            >
              {isGoogleDrive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-900/20">
                  <ImageIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-1" />
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center line-clamp-2 px-1">
                    {image.questionText}
                  </p>
                </div>
              )}

              {!isGoogleDrive && isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
                  <Loader className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}

              {!isGoogleDrive && isFailed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20">
                  <ImageIcon className="w-5 h-5 text-red-500 mb-1" />
                  <p className="text-xs text-red-600 dark:text-red-400 text-center line-clamp-2 px-1">
                    {image.questionText}
                  </p>
                </div>
              )}

              {!isGoogleDrive && !isLoading && !isFailed && (
                <img
                  src={image.url}
                  alt={image.questionText}
                  className="w-full h-full object-cover"
                  onLoad={() => handleImageLoad(image.url)}
                  onError={() => handleImageError(image.url)}
                />
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-start p-2">
                <p className="text-xs text-white font-medium truncate max-w-full opacity-0 group-hover:opacity-100 transition-opacity">
                  {image.questionText.substring(0, 20)}...
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ImagePreviewGrid;
