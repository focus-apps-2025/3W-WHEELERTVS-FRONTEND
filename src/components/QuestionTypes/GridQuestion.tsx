import React, { useEffect } from "react";
import type { FollowUpQuestion } from "../../types";

interface GridQuestionProps {
  question: FollowUpQuestion;
  value: Record<string, string | string[]>;
  onChange: (value: Record<string, string | string[]>) => void;
  type: "radio" | "checkbox";
  readOnly?: boolean;
  isApplied?: boolean;
}

export default function GridQuestion({
  question,
  value,
  onChange,
  type,
  readOnly = false,
  isApplied = false,
}: GridQuestionProps) {
  if (!question.gridOptions) return null;
  const { rows, columns } = question.gridOptions;

  // Initialize empty values for each row
  useEffect(() => {
    const initializedValue = { ...value };
    rows.forEach((row) => {
      if (!initializedValue[row]) {
        initializedValue[row] = type === "radio" ? "" : [];
      }
    });
    if (Object.keys(initializedValue).length > Object.keys(value).length) {
      onChange(initializedValue);
    }
  }, [rows, type, value, onChange]);

  const handleChange = (row: string, col: string, checked: boolean) => {
    if (readOnly) return;
    if (type === "radio") {
      onChange({ ...value, [row]: col });
    } else {
      const currentValues = (value[row] as string[]) || [];
      const newValues = checked
        ? [...currentValues, col]
        : currentValues.filter((v) => v !== col);
      onChange({ ...value, [row]: newValues });
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
              {question.text}
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200">
          {rows.map((row) => (
            <tr key={row} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                {row}
              </td>
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-6 py-4 whitespace-nowrap text-center"
                >
                  <input
                    type={type}
                    name={`${question.id}-${row}`}
                    checked={
                      type === "radio"
                        ? value[row] === col
                        : (value[row] as string[])?.includes(col)
                    }
                    onChange={(e) => handleChange(row, col, e.target.checked)}
                    disabled={readOnly}
                    className={`h-4 w-4 ${isApplied ? 'text-emerald-600 focus:ring-emerald-500' : 'text-blue-600 focus:ring-blue-500'} border-gray-300 ${
                      readOnly ? "cursor-not-allowed" : ""
                    }`}
                    required={
                      question.required && type === "radio" && !value[row]
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
