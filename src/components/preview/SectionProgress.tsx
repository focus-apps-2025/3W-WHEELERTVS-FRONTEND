import React from "react";

interface SectionProgressProps {
  currentSection: number;
  totalSections: number;
}

export default function SectionProgress({
  currentSection,
  totalSections,
}: SectionProgressProps) {
  return (
    <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200">
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
      <p className="text-sm font-medium text-gray-600">
        Section {currentSection + 1} of {totalSections}
      </p>
    </div>
  );
}
