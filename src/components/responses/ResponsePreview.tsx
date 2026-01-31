import React from 'react';
import { X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { Question, Response } from '../../types';
import { formatTimestamp } from '../../utils/dateUtils';
import ImageLink from '../ImageLink';
import { isImageUrl } from '../../utils/answerTemplateUtils';

interface ResponsePreviewProps {
  response: Response;
  question: Question;
  onClose: () => void;
}

export default function ResponsePreview({ response, question, onClose }: ResponsePreviewProps) {
  const renderHighlightedAnswer = (val: any) => {
    const strValue = String(val);
    const normalized = strValue.trim().toLowerCase();
    
    let bgColor = "";
    let textColor = "";
    let borderColor = "";
    let Icon = null;
    
    const isYes = normalized === "yes";
    const isNo = normalized === "no";
    const isNA = normalized === "n/a" || normalized === "na" || normalized === "not applicable";
    
    if (isYes) {
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

    if (!isYes && !isNo && !isNA) {
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

  const allQuestions = question.sections.length > 0
    ? question.sections.flatMap(section => section.questions)
    : question.followUpQuestions;

  const renderAnswer = (answer: any) => {
    if (Array.isArray(answer)) {
      return answer.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 mb-2">
          {renderHighlightedAnswer(item)}
        </div>
      ));
    }
    if (typeof answer === 'object') {
      return (
        <div className="space-y-2">
          {Object.entries(answer).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="font-medium text-gray-600 dark:text-gray-400">{key}:</span>
              {renderHighlightedAnswer(value)}
            </div>
          ))}
        </div>
      );
    }
    return renderHighlightedAnswer(answer);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Response Preview
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Submitted on {formatTimestamp(response.timestamp)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
              {question.title}
            </h4>
            {allQuestions.map((q) => {
              const answer = response.answers[q.id];
              if (!answer) return null;

              return (
                <div key={q.id} className="mb-4 last:mb-0">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    {q.text}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {renderAnswer(answer)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}