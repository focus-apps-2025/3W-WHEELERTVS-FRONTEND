import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import type { Question, Response } from '../../types';
import { questionsApi, responsesApi } from '../../api/storage';
import FormHierarchy from '../forms/FormHierarchy';

export default function SettingsForms() {
  const navigate = useNavigate();
  const [questions, setQuestions] = React.useState<Question[]>(() => questionsApi.getAll());
  const [responses, setResponses] = React.useState<Response[]>(() => responsesApi.getAll());

  const handleCreateForm = () => {
    navigate('/forms/create');
  };

  const handleCreateChildForm = (parentId: string) => {
    navigate(`/forms/create?parentId=${parentId}`);
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

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      // Delete the form and all its child forms
      const formToDelete = questions.find(q => q.id === id);
      if (formToDelete) {
        // Find all child forms recursively
        const getAllChildFormIds = (parentId: string): string[] => {
          const directChildren = questions.filter(q => q.parentFormId === parentId);
          return [
            ...directChildren.map(child => child.id),
            ...directChildren.flatMap(child => getAllChildFormIds(child.id))
          ];
        };

        const childFormIds = getAllChildFormIds(id);
        const allFormIdsToDelete = [id, ...childFormIds];

        // Delete all forms and their responses
        allFormIdsToDelete.forEach(formId => {
          // Delete form from storage
          questionsApi.delete(formId);

          // Delete all responses for this form
          const formResponses = responses.filter(r => r.questionId === formId);
          formResponses.forEach(response => {
            responsesApi.delete(response.id);
          });
        });

        // Update local state
        setQuestions(prevQuestions => 
          prevQuestions.filter(q => !allFormIdsToDelete.includes(q.id))
        );
        setResponses(prevResponses => 
          prevResponses.filter(r => !allFormIdsToDelete.includes(r.questionId))
        );
      }
    }
  };

  // Get main forms (forms without parents)
  const mainForms = questions.filter(q => !q.parentFormId);

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

      <div className="space-y-6">
        {mainForms.map(form => (
          <FormHierarchy
            key={form.id}
            form={form}
            allForms={questions}
            responses={responses}
            onCreateChild={handleCreateChildForm}
            onEdit={handleEdit}
            onViewResponses={handleViewResponses}
            onRespond={handleRespond}
            onDelete={handleDelete}
          />
        ))}

        {mainForms.length === 0 && (
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