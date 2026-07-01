import React from 'react';
import { Check } from 'lucide-react';
import type { Question, Response } from '../types';
import { formatTimestamp } from '../utils/dateUtils';

interface ParentResponseSelectorProps {
  parentForm: Question;
  responses: Response[];
  onSelect: (response: Response) => void;
}

export default function ParentResponseSelector({
  parentForm,
  responses,
  onSelect,
}: ParentResponseSelectorProps) {
  return (
    <div className="space-y-4">
      <p className="text-gray-600 dark:text-gray-400">
        Please select a response from the parent form "{parentForm.title}" to continue.
      </p>

      <div className="grid gap-4">
        {responses.map((response) => (
          <button
            key={response.id}
            onClick={() => onSelect(response)}
            className="text-left p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Submitted on {formatTimestamp(response.timestamp)}
                </p>
                <div className="space-y-1">
                  {parentForm.followUpQuestions.map(question => (
                    <div key={question.id} className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {question.text}:
                      </span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">
                        {Array.isArray(response.answers[question.id])
                          ? response.answers[question.id].join(', ')
                          : response.answers[question.id]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}