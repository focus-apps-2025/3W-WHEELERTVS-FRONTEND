import React from 'react';
import type { FollowUpQuestion } from '../../types';
import { useTheme } from "../../context/ThemeContext";

interface RatingQuestionProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  isApplied?: boolean;
}

export default function RatingQuestion({
  question,
  value,
  onChange,
  readOnly = false,
  isApplied = false,
}: RatingQuestionProps) {
  const { darkMode } = useTheme();
  
  // Default values based on common patterns if not specified
  const max = question.max || 5;
  const min = question.min !== undefined ? question.min : (max === 10 ? 0 : 1);
  const currentValue = value !== "" && value !== undefined ? parseInt(value) : null;

  const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Default labels based on NPS/CSAT if not provided
  const minLabel = question.minLabel || (max === 10 ? "Not at all likely" : "Very unsatisfied");
  const maxLabel = question.maxLabel || (max === 10 ? "Extremely likely" : "Very satisfied");

  return (
    <div className="space-y-4 px-1 p-2 rounded-xl transition-all duration-300">
      <div className="flex flex-col items-center">
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-2 w-full">
          {range.map((num) => {
            const isSelected = currentValue === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => !readOnly && onChange(num.toString())}
                disabled={readOnly}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center text-[13px] font-black transition-all duration-300 ${
                  isSelected
                    ? isApplied
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg scale-110 z-10'
                      : 'bg-slate-900 border-slate-900 text-white shadow-lg scale-110 z-10'
                    : darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:shadow-sm'
                } ${readOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer active:scale-90 hover:scale-105'}`}
              >
                {num}
              </button>
            );
          })}
        </div>
        
        <div className="flex justify-between w-full px-1 mt-1">
          <span className={`text-[10px] font-medium tracking-tight max-w-[45%] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {minLabel}
          </span>
          <span className={`text-[10px] font-medium tracking-tight text-right max-w-[45%] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {maxLabel}
          </span>
        </div>
      </div>
    </div>
  );
}