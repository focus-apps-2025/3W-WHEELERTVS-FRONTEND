import React from 'react';
import { Eye } from 'lucide-react';
import type { Question, Response } from '../types';
import { formatTimestamp } from '../utils/dateUtils';
import { getResponseSummary } from '../utils/responseUtils';

interface ResponseItemProps {
  response: Response;
  question: Question;
  onView: (response: Response) => void;
}

export default function ResponseItem({
  response,
  question,
  onView,
}: ResponseItemProps) {
  const summary = getResponseSummary(response, question);
  const formattedTimestamp = formatTimestamp(response.timestamp);

  return (
    <div className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50">
      <div>
        <p className="text-sm text-gray-500">{formattedTimestamp}</p>
        <p className="text-gray-700">{summary}</p>
      </div>
      <button
        onClick={() => onView(response)}
        className="flex items-center px-3 py-1 text-blue-600 hover:text-blue-800"
      >
        <Eye className="w-5 h-5 mr-1" />
        View
      </button>
    </div>
  );
}