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
import SliderFeedback from "./QuestionTypes/SliderFeedback";
import EmojiStarFeedback from "./QuestionTypes/EmojiStarFeedback";
import EmojiReactionFeedback from "./QuestionTypes/EmojiReactionFeedback";

interface QuestionRendererProps {
  question: FollowUpQuestion;
  value: any;
  onChange?: (value: any) => void;
  readOnly?: boolean;
  isFollowUp?: boolean;
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
  readOnly = false,
  isFollowUp = false,
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

      case "yesNoNA":
      case "radio":
      case "checkbox":
        return (
          <div className="space-y-2">
            {question.options?.map((option) => {
              const inputType =
                question.type === "checkbox" ? "checkbox" : "radio";
              return (
                <label
                  key={option}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800"
                >
                  <input
                    type={inputType}
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
                  <span className="text-gray-700 dark:text-gray-300">{option}</span>
                </label>
              );
            })}
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
            readOnly={readOnly}
          />
        );

      case "scale":
        return (
          <ScaleQuestion
            question={question}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        );

      case "slider-feedback":
        return (
          <SliderFeedback
            question={question}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        );

      case "emoji-star-feedback":
        return (
          <EmojiStarFeedback
            question={question}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        );

      case "emoji-reaction-feedback":
        return (
          <EmojiReactionFeedback
            question={question}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
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

  const questionText = question.text?.trim() || "";
  const showLabel = questionText.length > 0;

  return (
    <div className="space-y-3">
      {/* Parameter Display */}
      {question.subParam1 && (
        <div className="mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-300 dark:border-purple-600 rounded-lg">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
              {question.subParam1}
            </span>
          </div>
        </div>
      )}

      {question.imageUrl ? (
        <div className="relative inline-flex">
          <img
            src={question.imageUrl}
            alt={questionText || "Question image"}
            className="max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 object-contain"
          />
          {question.required && !showLabel ? (
            <span className="absolute top-2 right-2 text-lg font-semibold text-red-500">*</span>
          ) : null}
        </div>
      ) : null}
      {showLabel ? (
        <label className={`block ${isFollowUp ? "text-sm font-medium text-blue-700 dark:text-blue-300" : "font-medium text-gray-700 dark:text-gray-300"}`}>
          {questionText}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      ) : null}
      {question.description ? (
        <p className={`mb-2 ${isFollowUp ? "text-xs text-blue-600 dark:text-blue-400" : "text-sm text-gray-500 dark:text-gray-500"}`}>{question.description}</p>
      ) : null}
      {renderInput()}
    </div>
  );
}
