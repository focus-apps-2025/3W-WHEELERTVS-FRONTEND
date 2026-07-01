import React from 'react';
import type { Question, Response } from '../../types';
import ResponseChart from './ResponseChart';

interface DashboardChartsProps {
  questions: Question[];
  responses: Response[];
}

export default function DashboardCharts({ questions, responses }: DashboardChartsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Response Analytics</h2>
      <div className="grid gap-6">
        {questions.map(question => (
          <div key={question.id}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {question.title}
            </h3>
            <ResponseChart
              question={question}
              responses={responses.filter(r => r.questionId === question.id)}
            />
          </div>
        ))}
        {questions.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No forms available to analyze
          </p>
        )}
      </div>
    </div>
  );
}