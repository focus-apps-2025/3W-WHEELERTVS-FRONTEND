import React from "react";
import { useParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { FormWithSectionLinksResponder } from "../forms/FormWithSectionLinksResponder";

export const PublicFormPage: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();

  if (!formId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-red-200 p-12 max-w-md w-full text-center">
          <div className="flex items-center justify-center h-16 w-16 mx-auto bg-red-100 rounded-full mb-6">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Invalid Request
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            The form ID is missing. Please check the URL and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <FormWithSectionLinksResponder
        formId={formId}
        onSubmitted={(response) => {
          // Show success message
          console.log("Form submitted:", response);
        }}
        onError={(error) => {
          console.error("Form error:", error);
        }}
      />
    </div>
  );
};
