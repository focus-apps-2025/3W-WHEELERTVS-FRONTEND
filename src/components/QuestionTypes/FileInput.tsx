import React, { useCallback } from "react";
import { Upload } from "lucide-react";
import type { FollowUpQuestion } from "../../types";

interface FileInputProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function FileInput({
  question,
  value,
  onChange,
  readOnly = false,
}: FileInputProps) {
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          onChange(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    [onChange, readOnly]
  );

  return (
    <div className="space-y-4">
      <label
        className={`flex flex-col items-center px-4 py-6 border-2 border-dashed rounded-lg ${
          readOnly
            ? "cursor-not-allowed bg-gray-100 dark:bg-gray-700"
            : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      >
        <Upload className="w-8 h-8 text-gray-400 mb-2" />
        <span className="text-sm text-gray-500">
          {readOnly
            ? "File upload disabled"
            : "Click to upload or drag and drop"}
        </span>
        <input
          type="file"
          onChange={handleFileChange}
          disabled={readOnly}
          className="hidden"
          required={question.required && !value}
        />
      </label>

      {value && (
        <div className="mt-4">
          {value.startsWith("data:image") ? (
            <img
              src={value}
              alt="Uploaded file"
              className="max-w-full h-auto rounded-lg"
            />
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                File uploaded successfully
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
