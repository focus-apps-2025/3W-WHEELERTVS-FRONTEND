import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import type { Question } from "../../types";

interface FormCardProps {
  question: Question;
  hasSubmitted: boolean;
  showParentTitle?: boolean;
}

export default function FormCard({
  question,
  hasSubmitted,
  showParentTitle,
}: FormCardProps) {
  return (
    <div className="card p-6 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-primary-600 mb-2">
            {question.title}
          </h3>
          {showParentTitle && question.parentFormId && (
            <p className="text-sm text-primary-500 mb-2">
              Follow-up form for: {question.parentFormTitle}
            </p>
          )}
          <p className="text-primary-500 leading-relaxed">
            {question.description}
          </p>
        </div>
        <div className="flex items-center ml-6">
          {hasSubmitted ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Response Submitted</span>
            </div>
          ) : (
            <Link
              to={`/forms/${question.id}/respond`}
              className="btn-primary inline-flex items-center"
            >
              Open Form
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
