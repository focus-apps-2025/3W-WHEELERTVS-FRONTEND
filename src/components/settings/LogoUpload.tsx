import React from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { useNotification } from "../../context/NotificationContext";

interface LogoUploadProps {
  currentLogo?: string;
  onLogoChange: (logo: string) => void;
}

export default function LogoUpload({
  currentLogo,
  onLogoChange,
}: LogoUploadProps) {
  const { showError, showSuccess } = useNotification();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        // 1MB limit
        showError("File size should be less than 1MB", "File Too Large");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        onLogoChange(result);
        showSuccess("Logo uploaded successfully", "Success");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-6">
        <div className="flex-shrink-0 w-24 h-24 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {currentLogo ? (
            <img
              src={currentLogo}
              alt="Company logo"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        <div className="flex-1">
          <label className="flex flex-col items-center px-4 py-6 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400">
            <div className="flex items-center">
              <Upload className="w-6 h-6 text-gray-600 dark:text-gray-400 mr-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {currentLogo ? "Change logo" : "Upload a logo"}
              </span>
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              PNG, JPG or GIF (Max. 1MB)
            </p>
          </label>
        </div>
      </div>

      {currentLogo && (
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Current logo
            </span>
          </div>
          <button
            type="button"
            onClick={() => onLogoChange("")}
            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
