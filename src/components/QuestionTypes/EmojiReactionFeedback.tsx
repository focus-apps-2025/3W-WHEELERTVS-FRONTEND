import React from 'react';
import type { FollowUpQuestion } from '../../types';

interface EmojiReactionFeedbackProps {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
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
}: EmojiReactionFeedbackProps) {
  const selectedReaction = EMOJI_REACTIONS.find(r => r.value === value);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3">
        {EMOJI_REACTIONS.map((reaction) => (
          <button
            key={reaction.value}
            type="button"
            onClick={() => !readOnly && onChange(reaction.value)}
            disabled={readOnly}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all transform ${
              readOnly ? 'cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
            } ${
              value === reaction.value
                ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 scale-110'
                : 'bg-gray-50 dark:bg-gray-800'
            }`}
          >
            <span className="text-4xl">{reaction.emoji}</span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {reaction.label}
            </span>
            {value === reaction.value && (
              <div className="absolute top-1 right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
            )}
          </button>
        ))}
      </div>

      {selectedReaction && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-center">
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
