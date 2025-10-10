import React from 'react';
import { PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Question } from '../../types';
import FormCard from './FormCard';

interface FormListProps {
  questions: Question[];
}

export default function FormList({ questions }: FormListProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">Forms</h4>
        <Link
          to="/forms/create"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Create New Form
        </Link>
      </div>

      <div className="grid gap-4">
        {questions.map((question) => (
          <FormCard
            key={question.id}
            question={question}
          />
        ))}
        {questions.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No forms created yet
          </p>
        )}
      </div>
    </div>
  );
}