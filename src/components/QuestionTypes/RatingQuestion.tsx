import React from 'react';
import { Star } from 'lucide-react';
import type { FollowUpQuestion } from '../../types';

interface RatingQuestionProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
}

export default function RatingQuestion({
  question,
  value,
  onChange,
}: RatingQuestionProps) {
  const max = question.max || 5;
  const currentValue = parseInt(value) || 0;

  return (
    <div className="flex space-x-2">
      {Array.from({ length: max }).map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onChange((index + 1).toString())}
          className="focus:outline-none"
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