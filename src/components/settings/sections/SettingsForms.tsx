import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Eye, Edit2, FileText } from 'lucide-react';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import type { Question, Response } from '../../../types';
import { questionsApi } from '../../../api/storage';
import FormCard from './forms/FormCard';

export default function SettingsForms() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useLocalStorage<Question[]>('form_questions', []);
  const [responses] = useLocalStorage<Response[]>('form_responses', []);

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      questionsApi.delete(id);
      setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/forms/${id}/edit`);
  };

  const handleViewResponses = (id: string) => {
    navigate(`/forms/${id}/responses`);
  };

  const handleRespond = (id: string) => {
    navigate(`/forms/${id}/respond`);
  };

  const handleCreateForm = () => {
    navigate('/forms/create');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Forms</h2>
        <button
          onClick={handleCreateForm}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Create New Form
        </button>
      </div>

      <div className="space-y-4">
        {questions.map((question) => (
          <FormCard
            key={question.id}
            question={question}
            responseCount={responses.filter(r => r.questionId === question.id).length}
            onRespond={() => handleRespond(question.id)}
            onViewResponses={() => handleViewResponses(question.id)}
            onEdit={() => handleEdit(question.id)}
            onDelete={() => handleDelete(question.id)}
          />
        ))}

        {questions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No forms created yet</p>
            <button
              onClick={handleCreateForm}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              Create Your First Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}