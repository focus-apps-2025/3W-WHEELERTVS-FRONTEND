import React from "react";
import type { FollowUpQuestion } from "../../types";

interface DateTimeInputProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
   isApplied?: boolean;
}

export default function DateTimeInput({
  question,
  value,
  onChange,
  readOnly = false,
   isApplied = false,
}: DateTimeInputProps) {
  const type = question.type === "date" ? "date" : "time";

  return (
    <input
      type={type}
      value={value || ""}
      onChange={(e) => !readOnly && onChange(e.target.value)}
      disabled={readOnly}
      required={question.required}
      className={`w-full px-3 py-2 border rounded-lg transition-all duration-300 ${
        isApplied
          ? "border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/10"
          : "border-gray-300 bg-white"
      } ${
        readOnly
          ? "bg-gray-100 cursor-not-allowed"
          :  "focus:ring-2 focus:ring-blue-500"
      }`}
    />
  );
}
