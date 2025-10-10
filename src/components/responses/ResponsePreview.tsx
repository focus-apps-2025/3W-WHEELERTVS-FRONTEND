import React from 'react';
import { X } from 'lucide-react';
import type { Question, Response } from '../../types';
import { formatTimestamp } from '../../utils/dateUtils';

interface ResponsePreviewProps {
  response: Response;
  question: Question;
  onClose: () => void;
}

export default function ResponsePreview({ response, question, onClose }: ResponsePreviewProps) {
  // Get all questions from sections or fallback to followUpQuestions
  const allQuestions = question.sections.length > 0
    ? question.sections.flatMap(section => section.questions)
    : question.followUpQuestions;

  const renderAnswer = (answer: any) => {
    if (Array.isArray(answer)) {
      return answer.join(', ');
    }
    if (typeof answer === 'object') {
      return Object.entries(answer)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    return String(answer);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Response Preview
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Submitted on {formatTimestamp(response.timestamp)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
              {question.title}
            </h4>
            {allQuestions.map((q) => {
              const answer = response.answers[q.id];
              if (!answer) return null;

              return (
                <div key={q.id} className="mb-4 last:mb-0">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    {q.text}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {renderAnswer(answer)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}