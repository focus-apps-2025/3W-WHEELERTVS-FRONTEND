import React, { useState } from 'react';
import { Save, X, UserCircle, Settings as SettingsIcon, FileText } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import SettingsGeneral from './settings/SettingsGeneral';
import SettingsProfile from './settings/SettingsProfile';
import SettingsForms from './settings/SettingsForms';

interface SettingsProps {
  onClose: () => void;
}

type SettingsTab = 'general' | 'profile' | 'forms';

export default function Settings({ onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'profile', label: 'Profile', icon: UserCircle },
    { id: 'forms', label: 'Forms', icon: FileText },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 flex flex-col" style={{ height: 'calc(100vh - 2rem)' }}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-y-auto">
            <nav className="p-4 space-y-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as SettingsTab)}
                  className={`w-full flex items-center px-4 py-2 rounded-lg text-left ${
                    activeTab === id
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {activeTab === 'general' && <SettingsGeneral onClose={onClose} />}
              {activeTab === 'profile' && <SettingsProfile onClose={onClose} />}
              {activeTab === 'forms' && <SettingsForms />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}