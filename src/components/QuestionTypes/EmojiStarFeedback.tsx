import React from 'react';
import type { FollowUpQuestion } from '../../types';

interface EmojiStarFeedbackProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  isApplied?: boolean;
}

const STAR_EMOJIS = ['⭐', '⭐', '⭐', '⭐', '⭐'];
const STAR_LABELS = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export default function EmojiStarFeedback({
  value,
  onChange,
  readOnly = false,
  isApplied = false,
}: EmojiStarFeedbackProps) {
  const currentValue = parseInt(value) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => !readOnly && onChange((index + 1).toString())}
            disabled={readOnly}
            className={`focus:outline-none transition-transform transform ${
              readOnly ? 'cursor-not-allowed' : 'hover:scale-125 cursor-pointer'
            } ${index < currentValue ? 'scale-125' : 'opacity-60'}`}
          >
            <span className="text-4xl">{STAR_EMOJIS[index]}</span>
          </button>
        ))}
      </div>

      {currentValue > 0 && (
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {STAR_LABELS[currentValue - 1]}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {currentValue} out of 5 stars
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-2 mt-6">
        {STAR_LABELS.map((label) => (
          <div key={label} className="text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
