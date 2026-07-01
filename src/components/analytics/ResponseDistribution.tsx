import React from 'react';
import type { Question, Response } from '../../types';

interface ResponseDistributionProps {
  question: Question;
  responses: Response[];
}

export default function ResponseDistribution({ question, responses }: ResponseDistributionProps) {
  const distributionData = getDistributionData(question, responses);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Response Distribution
      </h4>
      <div className="space-y-4">
        {distributionData.map(({ label, count, percentage }) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {count} ({percentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDistributionData(question: Question, responses: Response[]) {
  // Get the first multiple choice question for demonstration
  const mcQuestion = question.followUpQuestions.find(q => 
    q.type === 'radio' || q.type === 'checkbox'
  );

  if (!mcQuestion || !mcQuestion.options) {
    return [];
  }

  const counts = mcQuestion.options.reduce((acc, option) => {
    acc[option] = 0;
    return acc;
  }, {} as Record<string, number>);

  responses.forEach(response => {
    const answer = response.answers[mcQuestion.id];
    if (Array.isArray(answer)) {
      answer.forEach(option => {
        if (counts[option] !== undefined) {
          counts[option]++;
        }
      });
    } else if (counts[answer] !== undefined) {
      counts[answer]++;
    }
  });

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return Object.entries(counts).map(([label, count]) => ({
    label,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}