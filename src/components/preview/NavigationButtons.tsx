import React from "react";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";

interface NavigationButtonsProps {
  isFirstSection: boolean;
  isLastSection: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
}

export default function NavigationButtons({
  isFirstSection,
  isLastSection,
  onPrevious,
  onNext,
  onSubmit,
  submitDisabled,
}: NavigationButtonsProps) {
  const submitButtonClasses = submitDisabled
    ? "flex items-center px-8 py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
    : "flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium";

  return (
    <div className="flex justify-between pt-8 border-t border-gray-200 dark:border-gray-700 mt-12">
      {!isFirstSection && (
        <button
          type="button"
          onClick={onPrevious}
          className="flex items-center px-8 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors font-medium"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Previous
        </button>
      )}

      <div className="ml-auto flex items-center gap-3">
        {!isLastSection && (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        )}
        <button
          type="submit"
          onClick={onSubmit}
          disabled={submitDisabled}
          className={submitButtonClasses}
        >
          Submit Response
          <Send className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
}
