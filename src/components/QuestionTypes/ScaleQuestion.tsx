import React from 'react';
import type { FollowUpQuestion } from '../../types';

interface ScaleQuestionProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
}

export default function ScaleQuestion({
  question,
  value,
  onChange,
}: ScaleQuestionProps) {
  const min = question.min || 0;
  const max = question.max || 10;
  const step = question.step || 1;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value || min}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
      <div className="text-center text-lg font-medium text-gray-700">
        {value || min}
      </div>
    </div>
  );
}