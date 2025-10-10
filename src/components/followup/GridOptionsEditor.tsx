import React from 'react';
import { Plus, Minus } from 'lucide-react';
import type { GridOption } from '../../types';

interface GridOptionsEditorProps {
  gridOptions: GridOption;
  onChange: (gridOptions: GridOption) => void;
}

export default function GridOptionsEditor({ gridOptions, onChange }: GridOptionsEditorProps) {
  const handleAddRow = () => {
    onChange({
      ...gridOptions,
      rows: [...gridOptions.rows, '']
    });
  };

  const handleAddColumn = () => {
    onChange({
      ...gridOptions,
      columns: [...gridOptions.columns, '']
    });
  };

  const handleUpdateRow = (index: number, value: string) => {
    const newRows = [...gridOptions.rows];
    newRows[index] = value;
    onChange({
      ...gridOptions,
      rows: newRows
    });
  };

  const handleUpdateColumn = (index: number, value: string) => {
    const newColumns = [...gridOptions.columns];
    newColumns[index] = value;
    onChange({
      ...gridOptions,
      columns: newColumns
    });
  };

  const handleRemoveRow = (index: number) => {
    onChange({
      ...gridOptions,
      rows: gridOptions.rows.filter((_, i) => i !== index)
    });
  };

  const handleRemoveColumn = (index: number) => {
    onChange({
      ...gridOptions,
      columns: gridOptions.columns.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rows</h4>
        <div className="space-y-2">
          {gridOptions.rows.map((row, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={row}
                onChange={(e) => handleUpdateRow(index, e.target.value)}
                placeholder={`Row ${index + 1}`}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleRemoveRow(index)}
                className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <Minus className="w-5 h-5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center px-4 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Row
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Columns</h4>
        <div className="space-y-2">
          {gridOptions.columns.map((column, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={column}
                onChange={(e) => handleUpdateColumn(index, e.target.value)}
                placeholder={`Column ${index + 1}`}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleRemoveColumn(index)}
                className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <Minus className="w-5 h-5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddColumn}
            className="flex items-center px-4 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Column
          </button>
        </div>
      </div>
    </div>
  );
}