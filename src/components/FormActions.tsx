import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Question } from '../types';
import { questionsApi } from '../api/storage';

interface FormActionsProps {
  question: Question;
  onEdit: () => void;
  onDelete: () => void;
}

export default function FormActions({ question, onEdit, onDelete }: FormActionsProps) {
  const navigate = useNavigate();

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      questionsApi.delete(question.id);
      onDelete();
      navigate('/forms');
    }
  };

  return (
    <div className="flex space-x-3">
      <button
        onClick={onEdit}
        className="flex items-center px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
      >
        <Edit2 className="w-5 h-5 mr-2" />
        Edit Form
      </button>
      <button
        onClick={handleDelete}
        className="flex items-center px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
      >
        <Trash2 className="w-5 h-5 mr-2" />
        Delete Form
      </button>
    </div>
  );
}