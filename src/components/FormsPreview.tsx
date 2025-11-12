import React from "react";
import { useNavigate } from "react-router-dom";
import { Eye, FileText, ArrowRight } from "lucide-react";
import type { Question } from "../types";
import { questionsApi, formVisibilityApi } from "../api/storage";

export default function FormsPreview() {
  const navigate = useNavigate();
  const [forms] = React.useState<Question[]>(() => {
    // Get only parent forms (forms without parentFormId) that are marked as visible
    const allForms = questionsApi.getAll();
    return allForms.filter(
      (form) => !form.parentFormId && formVisibilityApi.isVisible(form.id)
    );
  });

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-primary-600 dark:text-primary-300 mb-2">
          Service Request Forms
        </h1>
        <p className="text-primary-500 dark:text-primary-200">
          Submit your car service requests and issues here
        </p>
      </div>

      {/* Forms Grid */}
      <div className="space-y-4">
        {forms.map((form) => (
          <div
            key={form.id}
            className="card p-6 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-900"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-300" />
                  </div>
                  <h2 className="text-lg font-medium text-primary-600 dark:text-primary-300">
                    {form.title}
                  </h2>
                </div>
                <p className="text-primary-500 dark:text-primary-200 leading-relaxed">
                  {form.description}
                </p>
              </div>
              <button
                onClick={() => navigate(`/forms/${form.id}/respond`)}
                className="btn-primary flex items-center ml-6"
              >
                <Eye className="w-4 h-4 mr-2" />
                Open Form
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {forms.length === 0 && (
          <div className="text-center py-16 card">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/30 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-10 h-10 text-primary-600 dark:text-primary-300" />
            </div>
            <h3 className="text-lg font-medium text-primary-600 dark:text-primary-300 mb-2">
              No Service Forms Available
            </h3>
            <p className="text-primary-500 dark:text-primary-200 max-w-md mx-auto">
              There are currently no service request forms available. Please
              check back later or contact the shop manager.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
