import React from 'react';
import { Moon } from 'lucide-react';
import { useTheme } from '../../../../context/ThemeContext';

export default function DarkModeSection() {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Moon className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h4 className="text-base font-medium text-gray-900 dark:text-white">
              Dark Mode
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Toggle dark mode appearance
            </p>
          </div>
        </div>
        
        <button
          type="button"
          role="switch"
          aria-checked={darkMode}
          onClick={toggleDarkMode}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            darkMode ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              darkMode ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}