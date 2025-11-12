import React, { useState } from 'react';
import { Eye, Grid, ArrowRight } from 'lucide-react';
import { SectionFollowUpCreator } from './SectionFollowUpCreator';
import { SectionBranchingPreview } from '../preview/SectionBranchingPreview';

interface FormWithSectionBranchingProps {
  onFormCreated?: (formId: string) => void;
}

export const FormWithSectionBranching: React.FC<FormWithSectionBranchingProps> = ({
  onFormCreated
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'preview'>('create');
  const [createdFormId, setCreatedFormId] = useState<string | null>(null);

  const handleFormCreated = (formId: string) => {
    setCreatedFormId(formId);
    setActiveTab('preview');
    if (onFormCreated) {
      onFormCreated(formId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Form Builder - Section Branching
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              <Grid className="h-4 w-4" />
              Create Form
            </button>
            {createdFormId && (
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                <Eye className="h-4 w-4" />
                Preview Flow
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {activeTab === 'create' ? (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800">
                <span className="font-semibold">Section Branching Logic:</span> Create a form where selecting an option in one section determines which section appears next. Perfect for conditional workflows.
              </p>
            </div>
            <SectionFollowUpCreator onFormCreated={handleFormCreated} />
          </div>
        ) : createdFormId ? (
          <div>
            <button
              onClick={() => setActiveTab('create')}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 mb-4 font-medium"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Back to Edit
            </button>
            <SectionBranchingPreview formId={createdFormId} isAdminPreview={true} />
          </div>
        ) : null}
      </div>
    </div>
  );
};
