import React, { useCallback, useMemo } from "react";
import { Upload } from "lucide-react";
import type { FollowUpQuestion } from "../../types";

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
    (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const reader = new FileReader();
        reader.onloadend = () => {
          onChange(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    [onChange, question.allowedFileTypes, readOnly]
  );

  return (
    <div className="space-y-4">
      <label
        className={`flex flex-col items-center px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg ${
          readOnly
            ? "cursor-not-allowed bg-gray-100"
            : "cursor-pointer hover:bg-gray-50"
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
          accept={accept}
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
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                File uploaded successfully
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
