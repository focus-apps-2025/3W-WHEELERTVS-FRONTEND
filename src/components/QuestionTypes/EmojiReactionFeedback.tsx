import React from 'react';
import type { FollowUpQuestion } from '../../types';

interface EmojiReactionFeedbackProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  isApplied?: boolean;
}

const EMOJI_REACTIONS = [
  { emoji: '😢', label: 'Sad', value: '1' },
  { emoji: '😕', label: 'Dull', value: '2' },
  { emoji: '😐', label: 'Neutral', value: '3' },
  { emoji: '😊', label: 'Smile', value: '4' },
  { emoji: '😂', label: 'Laugh', value: '5' },
];

export default function EmojiReactionFeedback({
  value,
  onChange,
  readOnly = false,
  isApplied = false,
}: EmojiReactionFeedbackProps) {
  const selectedReaction = EMOJI_REACTIONS.find(r => r.value === value);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3">
        {EMOJI_REACTIONS.map((reaction) => {
          const isSelected = value === reaction.value;
          return (
            <button
              key={reaction.value}
              type="button"
              onClick={() => !readOnly && onChange(reaction.value)}
              disabled={readOnly}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-300 transform ${
                readOnly ? 'cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
              } ${
                isSelected
                  ? isApplied
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-500 scale-110'
                    : 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 scale-110'
                  : 'bg-gray-50 dark:bg-gray-800'
              }`}
            >
              <span className="text-4xl">{reaction.emoji}</span>
              <span className={`text-xs font-medium ${isSelected && isApplied ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'}`}>
                {reaction.label}
              </span>
              {isSelected && (
                <div className={`absolute top-1 right-1 w-3 h-3 ${isApplied ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full`}></div>
              )}
            </button>
          );
        })}
      </div>

      {selectedReaction && (
        <div className={`p-4 rounded-lg text-center border transition-all duration-300 ${
          isApplied 
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700' 
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
        }`}>
          <div className="text-2xl mb-2">{selectedReaction.emoji}</div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {selectedReaction.label}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-500 text-center">
        Select your reaction feedback
      </div>
    </div>
  );
}
