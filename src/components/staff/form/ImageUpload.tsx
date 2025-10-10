import React from 'react';
import { Camera, Upload } from 'lucide-react';

interface ImageUploadProps {
  currentImage: string;
  onImageUpload: (file: File) => void;
}

export default function ImageUpload({ currentImage, onImageUpload }: ImageUploadProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        {currentImage ? (
          <img
            src={currentImage}
            alt="Profile preview"
            className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-lg"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-4 border-white dark:border-gray-700 shadow-lg">
            <Camera className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          </div>
        )}
        <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer shadow-lg hover:bg-blue-700 transition-colors">
          <Upload className="w-5 h-5 text-white" />
          <input
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}