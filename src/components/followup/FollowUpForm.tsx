import React, { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import type { FollowUpQuestion, Response } from '../../types';
import QuestionEditor from './QuestionEditor';
import AnswerEditor from './AnswerEditor';

interface FollowUpFormProps {
  response: Response;
  onSave: (updatedResponse: Response) => void;
}

export default function FollowUpForm({ response, onSave }: FollowUpFormProps) {
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>(response.answers);

  const handleAddQuestion = () => {
    const newQuestion: FollowUpQuestion = {
      id: crypto.randomUUID(),
      text: '',
      type: 'text',
      required: false,
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleUpdateQuestion = (questionId: string, updates: Partial<FollowUpQuestion>) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ));
  };

  const handleRemoveQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
    const { [questionId]: _, ...remainingAnswers } = answers;
    setAnswers(remainingAnswers);
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = () => {
    const updatedResponse: Response = {
      ...response,
      answers: {
        ...response.answers,
        ...answers
      }
    };
    onSave(updatedResponse);
  };

  return (
    <div className="space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Follow-up Questions
        </h2>
        <button
          onClick={handleAddQuestion}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </button>
      </div>

      <div className="space-y-6">
        {questions.map((question) => (
          <div key={question.id} className="border dark:border-gray-700 rounded-lg p-4 space-y-4">
            <QuestionEditor
              question={question}
              onUpdate={(updates) => handleUpdateQuestion(question.id, updates)}
              onRemove={() => handleRemoveQuestion(question.id)}
            />
            <AnswerEditor
              question={question}
              value={answers[question.id]}
              onChange={(value) => handleAnswerChange(question.id, value)}
            />
          </div>
        ))}
      </div>

      {questions.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Follow-ups
          </button>
        </div>
      )}
    </div>
  );
}