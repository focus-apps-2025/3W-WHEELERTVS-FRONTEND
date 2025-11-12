import React, { useCallback, useMemo, useState } from "react";
import { Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
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

export default function FileInput({
  question,
  value,
  onChange,
  readOnly = false,
}: FileInputProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            return;
          }
        }

        try {
          setUploading(true);
          setError(null);
          const result = await apiClient.uploadFile(file, "form");
          onChange(result.url);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Failed to upload file";
          setError(errorMsg);
          console.error("File upload error:", err);
          e.target.value = "";
        } finally {
          setUploading(false);
        }
      }
    },
    [onChange, question.allowedFileTypes, readOnly]
  );

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

      {value && !value.startsWith("/uploads") && value.startsWith("data:") ? (
        <div className="mt-4">
          <img
            src={value}
            alt="Uploaded file"
            className="max-w-full h-auto rounded-lg"
          />
        </div>
      ) : value && value.startsWith("/uploads") ? (
        <div className="mt-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div className="flex-1">
            {value.includes("image") || value.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <img
                src={value}
                alt="Uploaded file"
                className="max-w-full h-auto rounded-lg max-h-64"
              />
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                File uploaded successfully
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
