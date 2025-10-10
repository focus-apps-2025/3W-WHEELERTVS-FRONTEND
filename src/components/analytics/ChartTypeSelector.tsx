import React from 'react';
import { BarChart, PieChart } from 'lucide-react';

export type ChartType = 'bar' | 'pie';

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export default function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
      <button
        onClick={() => onChange('bar')}
        className={`flex items-center px-3 py-1.5 rounded-md transition-colors ${
          value === 'bar'
            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        <BarChart className="w-4 h-4 mr-1.5" />
        Bar
      </button>
      <button
        onClick={() => onChange('pie')}
        className={`flex items-center px-3 py-1.5 rounded-md transition-colors ${
          value === 'pie'
            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        <PieChart className="w-4 h-4 mr-1.5" />
        Pie
      </button>
    </div>
  );
}