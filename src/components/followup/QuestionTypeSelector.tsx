import React from 'react';
import type { QuestionType } from '../../types';

interface QuestionTypeSelectorProps {
  value: QuestionType;
  onChange: (type: QuestionType) => void;
}

export default function QuestionTypeSelector({ value, onChange }: QuestionTypeSelectorProps) {
  const questionTypes: { value: QuestionType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'paragraph', label: 'Paragraph' },
    { value: 'radio', label: 'Multiple Choice' },
    { value: 'checkbox', label: 'Checkboxes' },
    { value: 'search-select', label: 'Search/Filter Dropdown' },
    { value: 'email', label: 'Email' },
    { value: 'url', label: 'URL' },
    { value: 'tel', label: 'Phone Number' },
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'file', label: 'File Upload' },
    { value: 'range', label: 'Range' },
    { value: 'rating', label: 'Rating' },
    { value: 'rating-number', label: 'Ratings by Number' },
    { value: 'scale', label: 'Linear Scale' },
    { value: 'radio-grid', label: 'Multiple Choice Grid' },
    { value: 'checkbox-grid', label: 'Checkbox Grid' },
    { value: 'radio-image', label: 'Image Choice' },
    { value: 'chassis-with-zone', label: 'Chassis with Zone' },
    { value: 'chassis-without-zone', label: 'Chassis without Zone' },
    { value: 'zone-in', label: 'Zone In' },
    { value: 'zone-out', label: 'Zone Out' },
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as QuestionType)}
      className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
    >
      {questionTypes.map((type) => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  );
}