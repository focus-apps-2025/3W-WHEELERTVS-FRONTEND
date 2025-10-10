import React from "react";
import { X } from "lucide-react";
import type { Question, Response, Section } from "../types";
import { formatTimestamp } from "../utils/dateUtils";
import FormHeader from "./preview/FormHeader";
import SectionContent from "./preview/SectionContent";

interface ResponseFormViewProps {
  response: Response;
  question: Question;
  onClose: () => void;
}

export default function ResponseFormView({
  response,
  question,
  onClose,
}: ResponseFormViewProps) {
  // Initialize sections if they don't exist
  const sections: Section[] =
    question.sections?.length > 0
      ? question.sections
      : [
          {
            id: "default",
            title: question.title,
            description: question.description,
            questions: question.followUpQuestions,
          },
        ];

  // No-op for read-only
  const handleAnswerChange = () => {};

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl m-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Response View
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Submitted on {formatTimestamp(response.timestamp)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <FormHeader
            title={question.title}
            description={question.description}
            imageUrl={question.imageUrl}
          />

          <form className="space-y-8">
            {sections.length > 1 && (
              <div className="text-center text-sm text-gray-500">
                Section Progress: Viewing Response
              </div>
            )}

            {sections.map((section, index) => (
              <SectionContent
                key={section.id}
                section={section}
                formTitle={question.title}
                answers={response.answers}
                onAnswerChange={handleAnswerChange}
                readOnly={true}
              />
            ))}
          </form>
        </div>
      </div>
    </div>
  );
}
