import React from 'react';
import type { FollowUpQuestion } from '../../types';

interface SliderFeedbackProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const EMOJI_LEVELS = [
  { emoji: '😞', label: 'Very Bad', range: [1] },
  { emoji: '😕', label: 'Bad', range: [2, 3] },
  { emoji: '😐', label: 'Okay', range: [4, 5, 6, 7] },
  { emoji: '😊', label: 'Good', range: [8, 9] },
  { emoji: '❤️', label: 'Excellent', range: [10] },
];

export default function SliderFeedback({
  value,
  onChange,
  readOnly = false,
}: SliderFeedbackProps) {
  const currentValue = parseInt(value) || 5;

  const getColor = (val: number) => {
    if (val <= 3) return 'from-red-500 to-orange-500';
    if (val <= 5) return 'from-orange-500 to-yellow-500';
    if (val <= 7) return 'from-yellow-500 to-lime-500';
    return 'from-lime-500 to-green-500';
  };

  const getEmoji = (val: number) => {
    const level = EMOJI_LEVELS.find(l => l.range.includes(val));
    return level?.emoji || '😐';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-4xl">{getEmoji(currentValue)}</span>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentValue}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              out of 10
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-600 dark:text-gray-400">
          {currentValue <= 3 && 'Very Bad'}
          {currentValue > 3 && currentValue <= 5 && 'Bad'}
          {currentValue > 5 && currentValue <= 7 && 'Okay'}
          {currentValue > 7 && currentValue <= 9 && 'Good'}
          {currentValue > 9 && 'Excellent'}
        </div>
      </div>

      <div className="relative">
        <div
          className={`absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r ${getColor(currentValue)} transition-all duration-200`}
          style={{ width: `${(currentValue / 10) * 100}%` }}
        ></div>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={currentValue}
          onChange={(e) => !readOnly && onChange(e.target.value)}
          disabled={readOnly}
          className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600 ${
            readOnly ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 px-1">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>

      <div className="flex justify-between items-center mt-4 pt-4 border-t dark:border-gray-700">
        {EMOJI_LEVELS.map((level) => (
          <div key={level.emoji} className="text-center">
            <div className="text-2xl mb-1">{level.emoji}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {level.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
