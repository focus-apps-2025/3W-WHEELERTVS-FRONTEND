import React from 'react';
import type { FollowUpQuestion } from '../../types';
import QuestionRenderer from '../QuestionRenderer';

interface AnswerEditorProps {
  question: FollowUpQuestion;
  value: any;
  onChange: (value: any) => void;
}

export default function AnswerEditor({ question, value, onChange }: AnswerEditorProps) {
  return (
    <div className="border-t dark:border-gray-700 pt-4 mt-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Answer Preview
      </h4>
      <QuestionRenderer
        question={question}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}