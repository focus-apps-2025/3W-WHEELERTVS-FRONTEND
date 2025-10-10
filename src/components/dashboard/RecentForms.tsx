import React from 'react';
import { Eye } from 'lucide-react';
import type { Question } from '../../types';

interface RecentFormsProps {
  questions: Question[];
  onViewForm: (id: string) => void;
}

export default function RecentForms({ questions, onViewForm }: RecentFormsProps) {
  const recentForms = questions.slice(-5).reverse();

  return (
    <div className="space-y-4">
      {recentForms.map((form) => (
        <div
          key={form.id}
          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
        >
          <div>
            <h3 className="font-medium text-gray-900">{form.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-1">{form.description}</p>
          </div>
          <button
            onClick={() => onViewForm(form.id)}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </button>
        </div>
      ))}
      {recentForms.length === 0 && (
        <p className="text-center text-gray-500 py-4">No forms created yet</p>
      )}
    </div>
  );
}