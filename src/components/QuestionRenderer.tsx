import React from "react";
import type { FollowUpQuestion } from "../types";
import { questionTypes } from "../utils/questionTypes";
import DateTimeInput from "./QuestionTypes/DateTimeInput";
import FileInput from "./QuestionTypes/FileInput";
import GridQuestion from "./QuestionTypes/GridQuestion";
import RadioImageQuestion from "./QuestionTypes/RadioImageQuestion";
import RatingQuestion from "./QuestionTypes/RatingQuestion";
import ScaleQuestion from "./QuestionTypes/ScaleQuestion";
import SearchSelect from "./QuestionTypes/SearchSelect";
import ParagraphInput from "./QuestionTypes/ParagraphInput";

interface QuestionRendererProps {
  question: FollowUpQuestion;
  value: any;
  onChange?: (value: any) => void;
  readOnly?: boolean;
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
  readOnly = false,
}: QuestionRendererProps) {
  const renderInput = () => {
    switch (question.type) {
      case "paragraph":
        return (
          <ParagraphInput
            question={question}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        );

      case "search-select":
        return (
          <SearchSelect
            options={
              question.options?.map((opt) => ({ value: opt, label: opt })) || []
            }
            value={value || ""}
            onChange={onChange}
            placeholder="Select an option..."
            required={question.required}
            readOnly={readOnly}
          />
        );

      case "radio":
      case "checkbox":
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <label
                key={option}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50"
              >
                <input
                  type={question.type}
                  name={question.id}
                  value={option}
                  checked={
                    question.type === "checkbox"
                      ? Array.isArray(value) && value.includes(option)
                      : value === option
                  }
                  onChange={(e) => {
                    if (readOnly) return;
                    if (question.type === "checkbox") {
                      const newValue = Array.isArray(value) ? [...value] : [];
                      if (e.target.checked) {
                        newValue.push(option);
                      } else {
                        const index = newValue.indexOf(option);
                        if (index > -1) {
                          newValue.splice(index, 1);
                        }
                      }
                      onChange(newValue);
                    } else {
                      onChange(option);
                    }
                  }}
                  required={question.required && !value}
                  disabled={readOnly}
                  className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 ${
                    readOnly ? "cursor-not-allowed" : ""
                  }`}
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case "radio-grid":
      case "checkbox-grid":
        return (
          <GridQuestion
            question={question}
            value={value || {}}
            onChange={onChange}
            type={question.type === "radio-grid" ? "radio" : "checkbox"}
            readOnly={readOnly}
          />
        );

      case "radio-image":
        return (
          <RadioImageQuestion
            question={question}
            value={value}
            onChange={onChange}
          />
        );

      case "rating":
        return (
          <RatingQuestion
            question={question}
            value={value}
            onChange={onChange}
          />
        );

      case "scale":
        return (
          <ScaleQuestion
            question={question}
            value={value}
            onChange={onChange}
          />
        );

      case "file":
        return (
          <FileInput
            question={question}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        );

      case "date":
      case "time":
        return (
          <DateTimeInput
            question={question}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        );

      default:
        return (
          <input
            type={question.type}
            value={value || ""}
            onChange={(e) => !readOnly && onChange(e.target.value)}
            required={question.required}
            disabled={readOnly}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${
              readOnly
                ? "bg-gray-100 cursor-not-allowed"
                : "bg-white focus:ring-2 focus:ring-blue-500"
            }`}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <label className="block font-medium text-gray-700">
        {question.text}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {question.description && (
        <p className="text-sm text-gray-500 mb-2">{question.description}</p>
      )}
      {renderInput()}
    </div>
  );
}
