import React, { useState } from 'react';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English (US)', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
];

export default function LanguageSelector() {
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Globe className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            Display Language
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select your preferred language
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {languages.map(({ code, name, flag }) => (
          <label
            key={code}
            className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
              selectedLanguage === code
                ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-600'
            }`}
          >
            <input
              type="radio"
              name="language"
              value={code}
              checked={selectedLanguage === code}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="sr-only"
            />
            <span className="text-xl mr-3">{flag}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {name}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}