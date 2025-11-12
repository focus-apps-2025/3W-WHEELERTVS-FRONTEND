import React from "react";

interface SectionProgressProps {
  currentSection: number;
  totalSections: number;
  visitedCount?: number;
  totalCount?: number;
}

export default function SectionProgress({
  currentSection,
  totalSections,
  visitedCount,
  totalCount,
}: SectionProgressProps) {
  const hasBranching = visitedCount !== undefined && totalCount !== undefined && visitedCount < totalCount;
  
  return (
    <div className="flex flex-col mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {Array.from({ length: totalSections }).map((_, index) => (
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
          ))}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Section {currentSection + 1} of {totalSections}
          </p>
          {hasBranching && totalCount && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {Math.round(((currentSection + 1) / totalSections) * 100)}% of your path
            </p>
          )}
        </div>
      </div>
      {hasBranching && totalCount && (
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Branching: Showing {visitedCount} of {totalCount} available sections
        </p>
      )}
    </div>
  );
}
