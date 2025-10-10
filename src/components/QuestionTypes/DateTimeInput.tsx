import React from "react";
import type { FollowUpQuestion } from "../../types";

interface DateTimeInputProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function DateTimeInput({
  question,
  value,
  onChange,
  readOnly = false,
}: DateTimeInputProps) {
  const type = question.type === "date" ? "date" : "time";

  return (
    <input
      type={type}
      value={value || ""}
      onChange={(e) => !readOnly && onChange(e.target.value)}
      disabled={readOnly}
      required={question.required}
      className={`w-full px-3 py-2 border rounded-lg ${
        readOnly
          ? "bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
          : "focus:ring-2 focus:ring-blue-500"
      } dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
    />
  );
}
