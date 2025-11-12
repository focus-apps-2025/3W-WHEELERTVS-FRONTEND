import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, ChevronRight, Loader } from 'lucide-react';

interface BranchFlow {
  id: string;
  title: string;
  description?: string;
  questions: Array<{
    id: string;
    text: string;
    type: string;
    options: string[];
  }>;
  nextSections: Record<string, string>;
}

interface SectionFlow {
  formId: string;
  title: string;
  description: string;
  sections: BranchFlow[];
}

interface SectionBranchingPreviewProps {
  formId: string;
  isAdminPreview?: boolean;
}

export const SectionBranchingPreview: React.FC<SectionBranchingPreviewProps> = ({
  formId,
  isAdminPreview = false
}) => {
  const [sectionFlow, setSectionFlow] = useState<SectionFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSectionFlow();
  }, [formId]);

  const loadSectionFlow = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/forms/${formId}/section-flow`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load form flow');
      }

      const result = await response.json();
      setSectionFlow(result.data.sectionFlow);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load form flow';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  if (error || !sectionFlow) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
        <span className="text-red-700">{error || 'Failed to load form flow'}</span>
      </div>
    );
  }

  const togglePath = (pathId: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(pathId)) {
        next.delete(pathId);
      } else {
        next.add(pathId);
      }
      return next;
    });
  };

  const getSectionById = (sectionId: string): BranchFlow | undefined => {
    return sectionFlow.sections.find(s => s.id === sectionId);
  };

  const renderBranchingTree = (section: BranchFlow, depth: number = 0) => {
    const hasNextSections = Object.keys(section.nextSections).length > 0;

    return (
      <div key={section.id} className="mb-4">
        <div
          className={`p-4 bg-gradient-to-r ${
            depth === 0
              ? 'from-blue-500 to-blue-600'
              : 'from-indigo-500 to-indigo-600'
          } text-white rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
          onClick={() => hasNextSections && togglePath(section.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{section.title}</h3>
              {section.description && (
                <p className="text-blue-100 text-sm mt-1">{section.description}</p>
              )}
              {section.questions.length > 0 && (
                <p className="text-blue-100 text-sm mt-2">
                  Question: <span className="font-medium">{section.questions[0].text}</span>
                </p>
              )}
            </div>
            {hasNextSections && (
              <div className="ml-4">
                <ChevronRight
                  className={`h-5 w-5 transition-transform ${
                    expandedPaths.has(section.id) ? 'rotate-90' : ''
                  }`}
                />
              </div>
            )}
          </div>
        </div>

        {hasNextSections && expandedPaths.has(section.id) && (
          <div className="ml-8 mt-4 border-l-2 border-gray-300 dark:border-gray-600 pl-4 space-y-4">
            {Object.entries(section.nextSections).map(([optionLabel, nextSectionId]) => {
              const nextSection = getSectionById(nextSectionId);
              return (
                <div key={optionLabel}>
                  <div className="flex items-center mb-3">
                    <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                      {optionLabel}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 ml-2" />
                  </div>
                  {nextSection && renderBranchingTree(nextSection, depth + 1)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
            {isAdminPreview ? 'Section Flow Preview (Admin)' : 'Section Flow Preview'}
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-lg">{sectionFlow.description}</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Form Flow</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Click on sections to expand and see where each option leads:
          </p>
        </div>

        <div className="space-y-4">
          {sectionFlow.sections.map((section, index) => (
            <div key={section.id}>
              {index > 0 && (
                <div className="flex justify-center my-4">
                  <div className="text-gray-400 text-sm">↓</div>
                </div>
              )}
              {renderBranchingTree(section, 0)}
            </div>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">How It Works:</h3>
          <ul className="space-y-2 text-gray-600 dark:text-gray-400">
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 font-semibold">1.</span>
              <span>Customer starts with the first section</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 font-semibold">2.</span>
              <span>They select an option that determines which section appears next</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 font-semibold">3.</span>
              <span>They can navigate through all sections based on their choices</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 font-semibold">4.</span>
              <span>Finally, they submit the complete response with the path taken</span>
            </li>
          </ul>
        </div>

        {isAdminPreview && (
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-800">
              <span className="font-semibold">Admin View:</span> This preview shows how your form's section branching logic will work for customers. Each section's question options are linked to follow-up sections that will appear based on customer selections.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
