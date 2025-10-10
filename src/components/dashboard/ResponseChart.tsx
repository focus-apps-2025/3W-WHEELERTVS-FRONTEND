import React, { useMemo } from 'react';
import type { Question, Response } from '../../types';

interface ResponseChartProps {
  question: Question;
  responses: Response[];
}

export default function ResponseChart({ question, responses }: ResponseChartProps) {
  const chartData = useMemo(() => {
    const answerCounts: Record<string, Record<string, number>> = {};
    
    // Initialize answer counts for each question
    question.followUpQuestions.forEach(q => {
      if (q.options) {  // Only track questions with predefined options
        answerCounts[q.text] = {};
        q.options.forEach(option => {
          answerCounts[q.text][option] = 0;
        });
      }
    });

    // Count responses
    responses.forEach(response => {
      Object.entries(response.answers).forEach(([questionId, answer]) => {
        const q = question.followUpQuestions.find(q => q.id === questionId);
        if (!q || !q.options) return;  // Skip if question not found or has no options

        if (Array.isArray(answer)) {
          answer.forEach(a => {
            if (a) {  // Only count non-null/undefined answers
              answerCounts[q.text][a] = (answerCounts[q.text][a] || 0) + 1;
            }
          });
        } else if (answer) {  // Only count non-null/undefined answers
          answerCounts[q.text][answer] = (answerCounts[q.text][answer] || 0) + 1;
        }
      });
    });

    return answerCounts;
  }, [question, responses]);

  const maxValue = useMemo(() => {
    return Math.max(
      ...Object.values(chartData).flatMap(answers => 
        Object.values(answers)
      ),
      5 // Minimum scale
    );
  }, [chartData]);

  return (
    <div className="space-y-6">
      {Object.entries(chartData).map(([questionText, answers]) => {
        // Skip if no answers
        if (Object.values(answers).every(count => count === 0)) return null;

        // Calculate total responses for percentage
        const totalResponses = Object.values(answers).reduce((sum, count) => sum + count, 0);

        return (
          <div key={questionText} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {questionText}
            </h3>
            <div className="space-y-3">
              {Object.entries(answers).map(([answer, count]) => {
                const percentage = totalResponses > 0 
                  ? Math.round((count / totalResponses) * 100) 
                  : 0;

                return (
                  <div key={answer} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {answer}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${(count / maxValue) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}