import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FormWithFollowUpResponder } from "./FormWithFollowUpResponder";

export const FormWithFollowUpResponderWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            Form Not Found
          </h2>
          <p className="text-red-600 mb-4">
            The form ID is missing from the URL.
          </p>
          <button
            onClick={() => navigate("/forms/preview")}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Go Back to Forms
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormWithFollowUpResponder
      formId={id}
      onSubmitted={(response) => {
        console.log("Form submitted successfully:", response);
        const followUpFormId = response?.followUpFormId;

        if (followUpFormId) {
          if (
            window.confirm(
              "Form submitted successfully! Based on your response, there is a follow-up form. Would you like to fill it out now?"
            )
          ) {
            navigate(`/forms/${followUpFormId}/preview`);
            return;
          }
        } else {
          alert("Thank you! Your response has been submitted successfully.");
        }
        navigate("/forms/preview");
      }}
      onError={(error) => {
        console.error("Form submission error:", error);
        // Error is already displayed by the component itself
      }}
    />
  );
};

export default FormWithFollowUpResponderWrapper;
