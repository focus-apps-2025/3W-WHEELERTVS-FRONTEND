import React from "react";
import { X, Mail } from "lucide-react";
import type { Question, Response } from "../types";
import { formatTimestamp } from "../utils/dateUtils";
import FilePreview from "./FilePreview";
import SubmissionMetadata from "./SubmissionMetadata";
import ImageLink from "./ImageLink";
import { isImageUrl } from "../utils/answerTemplateUtils";
import { useNotification } from "../context/NotificationContext";

interface ResponseDetailsProps {
  response: Response;
  question: Question;
  onClose: () => void;
}

export default function ResponseDetails({
  response,
  question,
  onClose,
}: ResponseDetailsProps) {
  const { showInfo } = useNotification();

  const handleSendToMail = () => {
    showInfo("This feature is coming soon!", "Coming Soon");
  };

  const renderAnswer = (questionType: string, answer: any) => {
    if (questionType === "file" || questionType === "radio-image") {
      return <FilePreview data={answer as string} />;
    }

    if (Array.isArray(answer)) {
      return (
        <ul className="list-disc list-inside space-y-2">
          {answer.map((item, index) => (
            <li key={index} className="text-gray-700 dark:text-gray-300">
              {isImageUrl(String(item)) ? (
                <ImageLink text={String(item)} />
              ) : (
                item
              )}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof answer === "object") {
      return (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(answer).map(([key, value]) => (
              <tr key={key}>
                <td className="py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
                  {key}:
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">
                  {isImageUrl(String(value)) ? (
                    <ImageLink text={String(value)} />
                  ) : (
                    String(value)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (isImageUrl(String(answer))) {
      return <ImageLink text={String(answer)} />;
    }

    return <p className="text-gray-700 dark:text-gray-300">{String(answer)}</p>;
  };

  // Get all questions from sections or fallback to followUpQuestions
  const allQuestions =
    question.sections.length > 0
      ? question.sections.flatMap((section) => section.questions)
      : question.followUpQuestions;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Response Details
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Submitted on {formatTimestamp(response.timestamp)}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSendToMail}
              className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send to Mail
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {/* Submission Metadata */}
          {response.submissionMetadata && (
            <div className="mb-6">
              <SubmissionMetadata metadata={response.submissionMetadata} />
            </div>
          )}

          <div className="space-y-6">
            {allQuestions.map((q) => {
              const answer = response.answers[q.id];
              if (!answer) return null;

              return (
                <div key={q.id} className="border-b dark:border-gray-700 pb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {q.text}
                  </h4>
                  <div className="text-gray-700 dark:text-gray-300">
                    {renderAnswer(q.type, answer)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
