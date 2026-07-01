import React from 'react';
import { Eye, Edit2, FileText } from 'lucide-react';
import type { Question } from '../../../../types';

interface FormCardProps {
  question: Question;
  responseCount: number;
  onRespond: () => void;
  onViewResponses: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function FormCard({
  question,
  responseCount,
  onRespond,
  onViewResponses,
  onEdit,
  onDelete,
}: FormCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {question.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {question.description}
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
            {responseCount} responses
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onRespond}
            className="flex items-center px-3 py-1.5 text-green-600 hover:text-green-800"
          >
            <Eye className="w-4 h-4 mr-1" />
            Respond
          </button>
          <button
            onClick={onViewResponses}
            className="flex items-center px-3 py-1.5 text-blue-600 hover:text-blue-800"
          >
            <FileText className="w-4 h-4 mr-1" />
            View Responses
          </button>
          <button
            onClick={onEdit}
            className="flex items-center px-3 py-1.5 text-purple-600 hover:text-purple-800"
          >
            <Edit2 className="w-4 h-4 mr-1" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}