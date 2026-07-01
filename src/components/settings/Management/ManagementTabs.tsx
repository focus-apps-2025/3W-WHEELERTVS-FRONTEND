import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface ManagementTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export default function ManagementTabs({ tabs, activeTab, onTabChange }: ManagementTabsProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex items-center py-3 px-4 border-b-2 text-sm font-medium ${
              activeTab === id
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}