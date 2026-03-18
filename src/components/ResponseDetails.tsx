import React from "react";
import { X, Mail, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { Question, Response } from "../types";
import { formatTimestamp } from "../utils/dateUtils";
import FilePreview from "./FilePreview";
import SubmissionMetadata from "./SubmissionMetadata";
import ImageLink from "./ImageLink";
import { isImageUrl } from "../utils/answerTemplateUtils";
import { useNotification } from "../context/NotificationContext";
import { useTheme } from "../context/ThemeContext";

interface ResponseDetailsProps {
  response: Response;
  question: Question;
  onClose: () => void;
}

const getRankStyle = (answer: any, darkMode: boolean = false) => {
  if (answer === null || answer === undefined) return "";
  // Ensure we stringify object/array answers for consistent hashing
  const str = typeof answer === 'object' ? JSON.stringify(answer) : String(answer).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    { l: "bg-blue-600 text-white border-blue-700", d: "bg-blue-500 text-white border-blue-600" },
    { l: "bg-emerald-600 text-white border-emerald-700", d: "bg-emerald-500 text-white border-emerald-600" },
    { l: "bg-amber-600 text-white border-amber-700", d: "bg-amber-500 text-white border-amber-600" },
    { l: "bg-orange-600 text-white border-orange-700", d: "bg-orange-500 text-white border-orange-600" },
    { l: "bg-rose-600 text-white border-rose-700", d: "bg-rose-500 text-white border-rose-600" },
    { l: "bg-purple-600 text-white border-purple-700", d: "bg-purple-500 text-white border-purple-600" },
    { l: "bg-pink-600 text-white border-pink-700", d: "bg-pink-500 text-white border-pink-600" },
    { l: "bg-indigo-600 text-white border-indigo-700", d: "bg-indigo-500 text-white border-indigo-600" },
    { l: "bg-teal-600 text-white border-teal-700", d: "bg-teal-500 text-white border-teal-600" },
    { l: "bg-cyan-600 text-white border-cyan-700", d: "bg-cyan-500 text-white border-cyan-600" }
  ];
  const color = colors[Math.abs(hash) % colors.length];
  return darkMode ? color.d : color.l;
};

export default function ResponseDetails({
  response,
  question,
  onClose,
}: ResponseDetailsProps) {
  const { darkMode } = useTheme();
  const { showInfo } = useNotification();

  const renderHighlightedAnswer = (val: any, questionObj?: any) => {
    const isArray = Array.isArray(val);
    const strValue = isArray ? val.join(", ") : String(val || "");
    const normalized = strValue.trim().toLowerCase();
    
    let bgColor = "";
    let textColor = "";
    let borderColor = "";
    let Icon = null;
    
    const isYes = normalized === "yes";
    const isNo = normalized === "no";
    const isNA = normalized === "n/a" || normalized === "na" || normalized === "not applicable";
    
    // Quiz logic
    const isQuiz = questionObj && (questionObj.correctAnswer || (questionObj.correctAnswers && questionObj.correctAnswers.length > 0));
    let isCorrect = false;
    
    if (isQuiz) {
      if (questionObj.correctAnswers && questionObj.correctAnswers.length > 0) {
        if (isArray) {
          isCorrect = val.length === questionObj.correctAnswers.length && 
                      val.every((a: any) => questionObj.correctAnswers!.some((ca: any) => String(ca).toLowerCase() === String(a).toLowerCase()));
        } else {
          isCorrect = questionObj.correctAnswers.some((ca: any) => String(ca).toLowerCase() === normalized);
        }
      } else if (questionObj.correctAnswer) {
        isCorrect = String(questionObj.correctAnswer).toLowerCase() === normalized;
      }
    }

    if (isQuiz) {
      if (isCorrect) {
        bgColor = "bg-green-100 dark:bg-green-900/30";
        textColor = "text-green-800 dark:text-green-300";
        borderColor = "border-green-200 dark:border-green-800";
        Icon = CheckCircle;
      } else {
        bgColor = "bg-red-100 dark:bg-red-900/30";
        textColor = "text-red-800 dark:text-red-300";
        borderColor = "border-red-200 dark:border-red-800";
        Icon = XCircle;
      }
    } else if (isYes) {
      bgColor = "bg-green-100 dark:bg-green-900/30";
      textColor = "text-green-800 dark:text-green-300";
      borderColor = "border-green-200 dark:border-green-800";
      Icon = CheckCircle;
    } else if (isNo) {
      bgColor = "bg-red-100 dark:bg-red-900/30";
      textColor = "text-red-800 dark:text-red-300";
      borderColor = "border-red-200 dark:border-red-800";
      Icon = XCircle;
    } else if (isNA) {
      bgColor = "bg-yellow-100 dark:bg-yellow-900/30";
      textColor = "text-yellow-800 dark:text-yellow-300";
      borderColor = "border-yellow-200 dark:border-yellow-800";
      Icon = AlertTriangle;
    }

    if (isQuiz) {
      const correctAnswerDisplay = questionObj.correctAnswers && questionObj.correctAnswers.length > 0
        ? questionObj.correctAnswers.join(", ")
        : String(questionObj.correctAnswer || "");

      return (
        <div className="flex flex-row gap-3 w-full my-1">
          {/* Given Correct Answer - No color (Neutral) */}
          <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm">
            <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Given Correct Answer
            </div>
            <div className="font-medium text-gray-700 dark:text-gray-300">
              {correctAnswerDisplay}
            </div>
          </div>

          {/* Customer Filled Answer - Colored based on correctness */}
          <div className={`flex-1 ${bgColor} ${textColor} ${borderColor} rounded-lg p-3 border text-sm break-words font-medium flex items-center shadow-sm`}>
            <div className="w-full">
              <div className="text-[10px] font-bold opacity-70 uppercase tracking-wider mb-1">
                Customer Filled Answer
              </div>
              <div className="flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                <div className="flex-1">
                  {isImageUrl(strValue) ? (
                    <ImageLink text={strValue} />
                  ) : (
                    strValue
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!isQuiz && !isYes && !isNo && !isNA) {
      if (isImageUrl(strValue)) {
        return <ImageLink text={strValue} />;
      }
      return strValue;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${bgColor} ${textColor} ${borderColor}`}>
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {isImageUrl(strValue) ? <ImageLink text={strValue} /> : strValue}
      </span>
    );
  };

  const handleSendToMail = () => {
    showInfo("This feature is coming soon!", "Coming Soon");
  };

  const renderAnswer = (q: any, answer: any) => {
    const questionType = q.type;
    if (questionType === "file" || questionType === "radio-image") {
      return <FilePreview data={answer as string} />;
    }

    if (Array.isArray(answer)) {
      return (
        <ul className="list-disc list-inside space-y-2">
          {answer.map((item, index) => (
            <li key={index} className="text-gray-700 dark:text-gray-300">
              {renderHighlightedAnswer(item, q)}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof answer === "object") {
      // Special handling for Product NPS Buckets (Hierarchy)
      if (answer.level1 || answer.level2 || answer.level3) {
        const breadcrumb = [
          answer.level1,
          answer.level2,
          answer.level3,
          answer.level4,
          answer.level5,
          answer.level6,
        ]
          .filter(Boolean)
          .join(" > ");
        return <p className="text-gray-700 dark:text-gray-300 font-medium">{breadcrumb}</p>;
      }

      return (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(answer).map(([key, value]) => (
              <tr key={key}>
                <td className="py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
                  {key}:
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">
                  {renderHighlightedAnswer(value, q)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return renderHighlightedAnswer(answer, q);
  };

  // Recursive helper to collect all questions including nested ones
  const collectAllQuestions = (questions: any[], result: any[] = []) => {
    if (!questions) return result;
    questions.forEach(q => {
      result.push(q);
      if (q.followUpQuestions && Array.isArray(q.followUpQuestions)) {
        collectAllQuestions(q.followUpQuestions, result);
      }
    });
    return result;
  };

  // Get all questions from sections or fallback to followUpQuestions
  const allQs: any[] = [];
  if (question.sections && question.sections.length > 0) {
    question.sections.forEach(section => {
      if (section.questions) {
        collectAllQuestions(section.questions, allQs);
      }
    });
  } else if (question.followUpQuestions) {
    collectAllQuestions(question.followUpQuestions, allQs);
  }
  const allQuestions = allQs;

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
                    {renderAnswer(q, answer)}
                  </div>
                  {response.responseRanks?.[q.id] && (
                    <div className={`mt-2 text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm ${getRankStyle(answer)}`}>
                      #{response.responseRanks[q.id]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
