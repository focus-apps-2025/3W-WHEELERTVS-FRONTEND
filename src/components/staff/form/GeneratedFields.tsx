import React from 'react';
import { Copy } from 'lucide-react';

interface GeneratedFieldsProps {
  userId: string;
  password: string;
}

export default function GeneratedFields({ userId, password }: GeneratedFieldsProps) {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
        Generated Credentials
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            User ID
          </label>
          <div className="flex items-center">
            <input
              type="text"
              value={userId}
              readOnly
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border rounded-l-lg focus:ring-0 dark:border-gray-600 dark:text-gray-300"
            />
            <button
              type="button"
              onClick={() => handleCopy(userId)}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-l-0 rounded-r-lg hover:bg-gray-200 dark:hover:bg-gray-500"
            >
              <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Password
          </label>
          <div className="flex items-center">
            <input
              type="text"
              value={password}
              readOnly
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border rounded-l-lg focus:ring-0 dark:border-gray-600 dark:text-gray-300"
            />
            <button
              type="button"
              onClick={() => handleCopy(password)}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-l-0 rounded-r-lg hover:bg-gray-200 dark:hover:bg-gray-500"
            >
              <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}