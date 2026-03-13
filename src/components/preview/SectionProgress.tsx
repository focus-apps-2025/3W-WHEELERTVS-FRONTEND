import React from "react";

interface SectionProgressProps {
  currentSection: number;
  totalSections: number;
  visitedCount?: number;
  totalCount?: number;
  viewType?: string;
  sectionTitle?: string;
  questionIndex?: number;
  totalQuestionsInSection?: number;
  originalSectionIndex?: number;
  totalOriginalSections?: number;
}

export default function SectionProgress({
  currentSection,
  totalSections,
  visitedCount,
  totalCount,
  viewType,
  sectionTitle,
  questionIndex,
  totalQuestionsInSection,
  originalSectionIndex,
  totalOriginalSections,
}: SectionProgressProps) {
  const hasBranching = visitedCount !== undefined && totalCount !== undefined && visitedCount < totalCount;
  
  return (
    <div className="flex flex-col mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {viewType === "question-wise" ? (
            Array.from({ length: totalOriginalSections || 0 }).map((_, index) => (
              <div
                key={index}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index === originalSectionIndex
                    ? "bg-blue-600 scale-125"
                    : index < (originalSectionIndex || 0)
                    ? "bg-blue-400"
                    : "bg-gray-300"
                }`}
              />
            ))
          ) : (
            Array.from({ length: totalSections }).map((_, index) => (
              <div
                key={index}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index === currentSection
                    ? "bg-blue-600 scale-125"
                    : index < currentSection
                    ? "bg-blue-400"
                    : "bg-gray-300"
                }`}
              />
            ))
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {viewType === "question-wise" ? (
              <>
                Section {(originalSectionIndex || 0) + 1} of {totalOriginalSections}
                {totalQuestionsInSection !== undefined && totalQuestionsInSection > 0 && (
                  <span className="ml-2 text-blue-500 font-normal">
                    ({sectionTitle}: {(questionIndex || 0) + 1}/{totalQuestionsInSection})
                  </span>
                )}
              </>
            ) : (
              <>Section {currentSection + 1} of {totalSections}</>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {Math.round(((currentSection + 1) / totalSections) * 100)}% of your path
          </p>
        </div>
      </div>
      {!viewType || viewType !== "question-wise" ? (
        hasBranching && totalCount && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Branching: Showing {visitedCount} of {totalCount} available sections
          </p>
        )
      ) : null}
    </div>
  );
}
