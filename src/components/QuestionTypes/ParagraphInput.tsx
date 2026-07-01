import React from "react";
import type { FollowUpQuestion } from "../../types";

interface ParagraphInputProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  isApplied?: boolean;
}

export default function ParagraphInput({
  question,
  value,
  onChange,
  readOnly = false,
  isApplied = false,
}: ParagraphInputProps) {
  return (
    <div className="space-y-2">
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        required={question.required}
        readOnly={readOnly}
        className={`w-full px-4 py-3 border rounded-lg transition-all duration-300 ${
          isApplied
            ? "border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/10"
            : "border-gray-300 bg-white"
        } ${
          readOnly
            ? "bg-gray-100 cursor-not-allowed"
            : "focus:ring-2 focus:ring-blue-500"
        } min-h-[120px] resize-y`}
        placeholder={question.description || "Enter your response..."}
        rows={6}
      />
      {question.description && (
        <p className="text-sm text-gray-500 dark:text-gray-500">{question.description}</p>
      )}
    </div>
  );
}
