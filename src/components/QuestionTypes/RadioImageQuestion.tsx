import React from "react";
import type { FollowUpQuestion } from "../../types";

interface RadioImageQuestionProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  isApplied?: boolean;
}

export default function RadioImageQuestion({
  question,
  value,
  onChange,
  readOnly = false,
  isApplied = false,
}: RadioImageQuestionProps) {
  if (!question.options?.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {question.options.map((imageUrl) => {
        const isSelected = value === imageUrl;
        return (
          <label
            key={imageUrl}
            className={`relative ${
              readOnly ? "cursor-not-allowed" : "cursor-pointer"
            } rounded-lg overflow-hidden border-2 transition-all ${
              isSelected
                ? isApplied
                  ? "border-emerald-500 ring-4 ring-emerald-500/20"
                  : "border-blue-500 ring-2 ring-blue-500 ring-opacity-50"
                : readOnly
                ? "border-transparent"
                : "border-transparent hover:border-gray-300"
            }`}
          >
            <img src={imageUrl} alt="" className="w-full h-48 object-cover" />
            <input
              type="radio"
              name={question.id}
              value={imageUrl}
              checked={isSelected}
              onChange={(e) => !readOnly && onChange(e.target.value)}
              disabled={readOnly}
              className={`absolute top-2 right-2 h-4 w-4 ${
                isApplied ? "text-emerald-600 focus:ring-emerald-500" : "text-blue-600 focus:ring-blue-500"
              } border-gray-300 dark:border-gray-600`}
              required={question.required && !value}
            />
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 transition-opacity ${
                isSelected ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className={`w-4 h-4 border-2 border-white rounded-full ${isApplied && isSelected ? 'bg-emerald-500/20' : ''}`}>
                <div
                  className={`w-2 h-2 m-0.5 rounded-full transition-all ${
                    isSelected ? "bg-white" : ""
                  }`}
                />
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
