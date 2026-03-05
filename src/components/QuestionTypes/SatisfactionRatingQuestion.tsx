import React from 'react';
import type { FollowUpQuestion } from '../../types';
import { useTheme } from "../../context/ThemeContext";

interface SatisfactionRatingQuestionProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function SatisfactionRatingQuestion({
  question,
  value,
  onChange,
  readOnly = false,
}: SatisfactionRatingQuestionProps) {
  const { darkMode } = useTheme();
  
  const max = 5;
  const min = 1;
  const currentValue = value !== "" && value !== undefined ? parseInt(value) : null;

  const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Labels matching the requirement
  const minLabel = question.minLabel || "Very unsatisfied";
  const maxLabel = question.maxLabel || "Very satisfied";

  return (
    <div className="space-y-4 px-1 p-2 rounded-xl transition-all duration-300">
      <div className="flex flex-col inline-flex">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-4 mb-2">
          {range.map((num) => {
            const isSelected = currentValue === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => !readOnly && onChange(num.toString())}
                disabled={readOnly}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center text-[15px] font-medium transition-all duration-200 ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                    : darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                      : 'bg-white border-slate-300 text-slate-600 hover:border-slate-500'
                } ${readOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer active:scale-95'}`}
              >
                {num}
              </button>
            );
          })}
        </div>
        
        <div className="flex justify-between w-full mt-1 px-1">
          <span className={`text-[10px] sm:text-[11px] font-normal tracking-tight text-slate-500 dark:text-slate-400`}>
            {minLabel}
          </span>
          <span className={`text-[10px] sm:text-[11px] font-normal tracking-tight text-slate-500 dark:text-slate-400`}>
            {maxLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
