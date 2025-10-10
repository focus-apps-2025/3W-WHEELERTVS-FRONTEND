import React from 'react';
import { PlusCircle, Eye, Edit2, FileText, MessageSquarePlus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Question, Response } from '../../types';

interface FormHierarchyProps {
  form: Question;
  allForms: Question[];
  responses: Response[];
  onCreateChild: (parentId: string) => void;
  onEdit: (id: string) => void;
  onViewResponses: (id: string) => void;
  onRespond: (id: string) => void;
  onDelete: (id: string) => void;
  level?: number;
}

export default function FormHierarchy({
  form,
  allForms,
  responses,
  onCreateChild,
  onEdit,
  onViewResponses,
  onRespond,
  onDelete,
  level = 0,
}: FormHierarchyProps) {
  const getResponseCount = (formId: string) => {
    return responses.filter(r => r.questionId === formId).length;
  };

  // Get all child forms for this form
  const childForms = allForms.filter(f => f.parentFormId === form.id);

  return (
    <div className="relative">
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${level > 0 ? 'ml-8 border-l-2 border-blue-200 dark:border-blue-800' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              {level > 0 && (
                <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                  Follow-up Form
                </div>
              )}
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {form.title}
              </h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {form.description}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              {getResponseCount(form.id)} responses
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onRespond(form.id)}
              className="flex items-center px-3 py-1.5 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
            >
              <Eye className="w-4 h-4 mr-1" />
              Respond
            </button>
            <button
              onClick={() => onViewResponses(form.id)}
              className="flex items-center px-3 py-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <FileText className="w-4 h-4 mr-1" />
              View Responses
            </button>
            <button
              onClick={() => onEdit(form.id)}
              className="flex items-center px-3 py-1.5 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </button>
            <button
              onClick={() => onCreateChild(form.id)}
              className="flex items-center px-3 py-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <MessageSquarePlus className="w-4 h-4 mr-1" />
              Add Follow-up
            </button>
            <button
              onClick={() => onDelete(form.id)}
              className="flex items-center px-3 py-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Recursively render child forms */}
      {childForms.length > 0 && (
        <div className="mt-4 space-y-4">
          {childForms.map(childForm => (
            <FormHierarchy
              key={childForm.id}
              form={childForm}
              allForms={allForms}
              responses={responses}
              onCreateChild={onCreateChild}
              onEdit={onEdit}
              onViewResponses={onViewResponses}
              onRespond={onRespond}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}