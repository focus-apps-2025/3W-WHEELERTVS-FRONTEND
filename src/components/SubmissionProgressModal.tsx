import React from "react";
import { Loader, CheckCircle, AlertCircle, Image as ImageIcon } from "lucide-react";

interface SubmissionProgressModalProps {
  isOpen: boolean;
  status: "idle" | "processing" | "converting" | "uploading" | "complete" | "error";
  currentImage: number;
  totalImages: number;
  currentMessage: string;
  errorMessage?: string;
}

export default function SubmissionProgressModal({
  isOpen,
  status,
  currentImage,
  totalImages,
  currentMessage,
  errorMessage,
}: SubmissionProgressModalProps) {
  if (!isOpen) {
    return null;
  }

  const isComplete = status === "complete";
  const isError = status === "error";
  const isProcessing = status === "processing" || status === "converting" || status === "uploading";

  const progress = totalImages > 0 ? (currentImage / totalImages) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-8 py-6">
          <div className="flex items-center gap-3">
            {isProcessing && <Loader className="w-6 h-6 text-white animate-spin" />}
            {isComplete && <CheckCircle className="w-6 h-6 text-white" />}
            {isError && <AlertCircle className="w-6 h-6 text-white" />}
            <h2 className="text-xl font-bold text-white">
              {isComplete ? "Submission Complete" : isError ? "Submission Error" : "Processing Images"}
            </h2>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Status Message */}
          <div className="text-center space-y-2">
            <p className="text-gray-700 dark:text-gray-200 font-medium">
              {currentMessage}
            </p>
            {totalImages > 0 && !isComplete && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentImage} of {totalImages} {totalImages === 1 ? "image" : "images"}
              </p>
            )}
          </div>

          {/* Progress Bar */}
          {totalImages > 0 && !isComplete && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* Processing Steps */}
          {isProcessing && (
            <div className="space-y-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  status === "converting" || status === "uploading" 
                    ? "bg-blue-600 text-white" 
                    : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                }`}>
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {status === "converting" ? "Downloading from Google Drive" : "Uploading to Cloudinary"}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {status === "converting" ? "Fetching image..." : "Uploading to cloud storage..."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 rounded" />
                <Loader className="w-3 h-3 animate-spin" />
                <div className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 rounded" />
              </div>
            </div>
          )}

          {/* Error Message */}
          {isError && errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-600 p-4 rounded">
              <p className="text-sm text-red-800 dark:text-red-200">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Success Message */}
          {isComplete && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-600 p-4 rounded">
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                ✓ All images successfully converted and saved to Cloudinary
              </p>
            </div>
          )}

          {/* Estimated Time */}
          {isProcessing && totalImages > 0 && (
            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              <p>Estimated time: ~{totalImages * 10} seconds</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
