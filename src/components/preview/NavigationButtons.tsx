import React from "react";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";

interface NavigationButtonsProps {
  isFirstSection: boolean;
  isLastSection: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export default function NavigationButtons({
  isFirstSection,
  isLastSection,
  onPrevious,
  onNext,
  onSubmit,
}: NavigationButtonsProps) {
  return (
    <div className="flex justify-between pt-8 border-t border-gray-200 mt-12">
      {!isFirstSection && (
        <button
          type="button"
          onClick={onPrevious}
          className="flex items-center px-8 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Previous
        </button>
      )}

      {!isLastSection ? (
        <button
          type="button"
          onClick={onNext}
          className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-auto font-medium"
        >
          Next
          <ChevronRight className="w-5 h-5 ml-2" />
        </button>
      ) : (
        <button
          type="submit"
          onClick={onSubmit}
          className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-auto font-medium"
        >
          Submit Response
          <Send className="w-5 h-5 ml-2" />
        </button>
      )}
    </div>
  );
}
