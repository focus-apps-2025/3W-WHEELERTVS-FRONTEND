import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface OptionsInputProps {
  options: string[];
  onChange: (options: string[]) => void;
}

export default function OptionsInput({ options, onChange }: OptionsInputProps) {
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onChange(newOptions);
  };

  const addOption = () => {
    onChange([...options, '']);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {options.map((option, index) => (
        <div key={index} className="flex items-center space-x-2">
          <input
            type="text"
            value={option}
            onChange={(e) => handleOptionChange(index, e.target.value)}
            placeholder={`Option ${index + 1}`}
            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <button
            type="button"
            onClick={() => removeOption(index)}
            className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addOption}
        className="flex items-center px-4 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <Plus className="w-4 h-4 mr-1" />
        Add Option
      </button>
    </div>
  );
}