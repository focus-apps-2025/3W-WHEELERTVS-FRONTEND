import React from 'react';
import { Star } from 'lucide-react';
import type { FollowUpQuestion } from '../../types';

interface RatingQuestionProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function RatingQuestion({
  question,
  value,
  onChange,
  readOnly = false,
}: RatingQuestionProps) {
  const max = question.max || 5;
  const currentValue = parseInt(value) || 0;

  return (
    <div className="flex space-x-2">
      {Array.from({ length: max }).map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => !readOnly && onChange((index + 1).toString())}
          disabled={readOnly}
          className={`focus:outline-none transition-transform ${
            readOnly ? 'cursor-not-allowed' : 'hover:scale-110 cursor-pointer'
          }`}
        >
          <Star
            className={`w-8 h-8 ${
              index < currentValue
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}