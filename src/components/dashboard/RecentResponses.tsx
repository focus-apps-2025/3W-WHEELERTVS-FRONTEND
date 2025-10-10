import React from 'react';
import { Eye } from 'lucide-react';
import type { Question, Response } from '../../types';
import { formatTimestamp } from '../../utils/dateUtils';

interface RecentResponsesProps {
  responses: Response[];
  questions: Question[];
  onViewResponse: (questionId: string, responseId: string) => void;
}

export default function RecentResponses({ 
  responses, 
  questions, 
  onViewResponse 
}: RecentResponsesProps) {
  const recentResponses = responses.slice(-5).reverse();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Form
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Submitted
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              First Answer
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {recentResponses.map((response) => {
            const question = questions.find(q => q.id === response.questionId);
            const firstQuestionId = question?.followUpQuestions[0]?.id;
            const firstAnswer = firstQuestionId ? response.answers[firstQuestionId] : null;
            
            return (
              <tr key={response.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {question?.title || 'Unknown Form'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {formatTimestamp(response.timestamp)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 truncate max-w-xs">
                    {firstAnswer ? (
                      Array.isArray(firstAnswer) 
                        ? firstAnswer.join(', ') 
                        : String(firstAnswer)
                    ) : (
                      'No answers'
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={() => onViewResponse(response.questionId, response.id)}
                    className="flex items-center text-blue-600 hover:text-blue-800 ml-auto"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </button>
                </td>
              </tr>
            );
          })}
          {recentResponses.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                No responses yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}