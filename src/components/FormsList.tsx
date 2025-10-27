import React from "react";
import { Link } from "react-router-dom";
import type { Question, Response } from "../types";
import FormCard from "./forms/FormCard";

interface FormsListProps {
  questions: Question[];
  responses?: Response[];
}

export default function FormsList({
  questions = [],
  responses = [],
}: FormsListProps) {
  const hasSubmittedResponse = (questionId: string) => {
    return responses.some((response) => response.questionId === questionId);
  };

  // Get main forms only
  const mainForms = (questions || []).filter((q) => !q.parentFormId);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-primary-600 mb-2">
          Forms Management
        </h1>
        <p className="text-primary-500">Create and manage your forms</p>
      </div>

      {/* Main Forms */}
      <div className="space-y-4">
        {mainForms.map((question) => (
          <FormCard
            key={question.id}
            question={question}
            hasSubmitted={hasSubmittedResponse(question.id)}
          />
        ))}
      </div>

      {questions.length === 0 && (
        <div className="text-center py-16 card">
          <p className="text-primary-500 mb-4">
            No forms have been created yet
          </p>
          <Link
            to="/forms/create"
            className="btn-primary inline-flex items-center"
          >
            Create Your First Form
          </Link>
        </div>
      )}
    </div>
  );
}
