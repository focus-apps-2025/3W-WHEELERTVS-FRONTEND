import React from "react";
import { Image, Upload } from "lucide-react";

interface ImageUploadProps {
  imageUrl?: string;
  type: "logo" | "header";
  onUpload: (file: File) => void;
}

export default function ImageUpload({
  imageUrl,
  type,
  onUpload,
}: ImageUploadProps) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="card p-6 bg-neutral-50">
      <label className="block text-sm font-medium text-primary-600 mb-4">
        {type === "logo" ? "Logo" : "Header Image"}
      </label>
      <div className="flex items-center space-x-6">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={type === "logo" ? "Logo" : "Header"}
            className={`${
              type === "logo"
                ? "w-16 h-16 object-contain"
                : "w-32 h-20 object-cover rounded-lg"
            }`}
          />
        )}
        <label className="btn-secondary flex items-center cursor-pointer">
          {type === "logo" ? (
            <Image className="w-4 h-4 mr-2" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {type === "logo" ? "Choose Logo" : "Choose Image"}
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
