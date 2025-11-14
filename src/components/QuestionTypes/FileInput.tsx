import React, { useCallback, useMemo, useRef, useState } from "react";
import { Upload, Loader2, AlertCircle, CheckCircle2, Eye, X } from "lucide-react";
import type { FollowUpQuestion } from "../../types";
import { apiClient } from "../../api/client";

interface FileInputProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const FILE_ACCEPT_MAP: Record<string, string[]> = {
  image: ["image/*"],
  pdf: ["application/pdf", ".pdf"],
  excel: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls",
    ".xlsx",
  ],
};

const FILE_VALIDATORS: Record<string, (file: File) => boolean> = {
  image: (file) => file.type.startsWith("image/"),
  pdf: (file) =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
  excel: (file) => {
    const allowedMimes = new Set(
      FILE_ACCEPT_MAP.excel.filter((value) => value.startsWith("application/"))
    );
    const lowerName = file.name.toLowerCase();
    return (
      allowedMimes.has(file.type) ||
      lowerName.endsWith(".xls") ||
      lowerName.endsWith(".xlsx")
    );
  },
};

const FILE_TYPE_LABELS: Record<string, string> = {
  image: "image",
  pdf: "PDF",
  excel: "Excel",
};

const resolveFileName = (fileUrl: string) => {
  if (!fileUrl) {
    return "";
  }
  if (fileUrl.startsWith("data:")) {
    return "Embedded file";
  }
  try {
    const url = new URL(fileUrl, "http://dummy.local");
    const segments = url.pathname.split("/").filter(Boolean);
    const fileName = segments[segments.length - 1] || "Uploaded file";
    return decodeURIComponent(fileName);
  } catch (error) {
    const parts = fileUrl.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "Uploaded file");
  }
};

const isImageUrl = (fileUrl: string) => {
  if (!fileUrl) {
    return false;
  }
  if (fileUrl.startsWith("data:")) {
    return fileUrl.startsWith("data:image");
  }
  return /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(fileUrl);
};

export default function FileInput({
  question,
  value,
  onChange,
  readOnly = false,
}: FileInputProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fileName = useMemo(() => resolveFileName(value), [value]);
  const showImagePreview = useMemo(() => isImageUrl(value), [value]);

  const accept = useMemo(() => {
    if (!question.allowedFileTypes || question.allowedFileTypes.length === 0) {
      return undefined;
    }
    const values = question.allowedFileTypes
      .flatMap((type) => FILE_ACCEPT_MAP[type] ?? [])
      .filter(Boolean);
    if (values.length === 0) {
      return undefined;
    }
    return Array.from(new Set(values)).join(",");
  }, [question.allowedFileTypes]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      const file = e.target.files?.[0];
      if (file) {
        const allowed = question.allowedFileTypes;
        if (allowed && allowed.length > 0) {
          const isValid = allowed.some((type) => {
            const validator = FILE_VALIDATORS[type];
            return validator ? validator(file) : true;
          });
          if (!isValid) {
            const allowedLabels = allowed
              .map((type) => FILE_TYPE_LABELS[type] ?? type)
              .join(", ");
            window.alert(`Please upload a ${allowedLabels} file.`);
            e.target.value = "";
            if (inputRef.current) {
              inputRef.current.value = "";
            }
            return;
          }
        }

        try {
          setUploading(true);
          setError(null);
          const result = await apiClient.uploadFile(file, "form", question.id);
          const uploadedUrl = apiClient.resolveUploadedFileUrl(result);

          if (!uploadedUrl) {
            throw new Error("File upload did not return a valid URL");
          }

          onChange(uploadedUrl);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Failed to upload file";
          setError(errorMsg);
          console.error("File upload error:", err);
          e.target.value = "";
          if (inputRef.current) {
            inputRef.current.value = "";
          }
        } finally {
          setUploading(false);
        }
      }
    },
    [onChange, question.allowedFileTypes, readOnly]
  );

  const handleRemoveFile = useCallback(() => {
    if (readOnly) {
      return;
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onChange("");
  }, [onChange, readOnly]);

  return (
    <div className="space-y-4">
      <label
        className={`flex flex-col items-center px-4 py-6 border-2 border-dashed rounded-lg ${
          readOnly || uploading
            ? "cursor-not-allowed bg-gray-100 dark:bg-gray-800"
            : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
        } border-gray-300 dark:border-gray-600 ${error ? "border-red-300 dark:border-red-600" : ""}`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 text-blue-400 mb-2 animate-spin" />
            <span className="text-sm text-blue-600 dark:text-blue-400">
              Uploading file...
            </span>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500 dark:text-gray-500">
              {readOnly
                ? "File upload disabled"
                : "Click to upload or drag and drop"}
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={readOnly || uploading}
          className="hidden"
          required={question.required && !value}
        />
      </label>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {value ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {fileName || "Uploaded file"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {showImagePreview ? "Image uploaded" : "File uploaded successfully"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40 dark:border-blue-700"
              >
                <Eye className="w-4 h-4" />
                View
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 dark:text-red-300 dark:bg-red-900/40 dark:border-red-700"
                >
                  <X className="w-4 h-4" />
                  Remove
                </button>
              )}
            </div>
          </div>
          {showImagePreview ? (
            <img
              src={value}
              alt={fileName || "Uploaded file"}
              className="max-w-full h-auto rounded-lg max-h-64 border border-gray-200 dark:border-gray-700"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
