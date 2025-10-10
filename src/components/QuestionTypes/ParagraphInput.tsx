import React from "react";
import type { FollowUpQuestion } from "../../types";

interface ParagraphInputProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function ParagraphInput({
  question,
  value,
  onChange,
  readOnly = false,
}: ParagraphInputProps) {
  return (
    <div className="space-y-2">
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        required={question.required}
        readOnly={readOnly}
        className={`w-full px-4 py-3 border rounded-lg ${
          readOnly
            ? "bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
            : "focus:ring-2 focus:ring-blue-500"
        } dark:bg-gray-800 dark:border-gray-600 dark:text-white min-h-[120px] resize-y`}
        placeholder={question.description || "Enter your response..."}
        rows={6}
      />
      {question.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {question.description}
        </p>
      )}
    </div>
  );
}
