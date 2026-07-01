import React, { useState } from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import TeamManagement from './staff/TeamManagement';
import RoleManagement from './staff/RoleManagement';

interface SettingsStaffProps {
  onClose: () => void;
}

export default function SettingsStaff({ onClose }: SettingsStaffProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'roles'>('team');

  const tabs = [
    { id: 'team', label: 'Team Management', icon: Users },
    { id: 'roles', label: 'Role Management', icon: ShieldCheck },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
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

      <div>
        {activeTab === 'team' && <TeamManagement onClose={onClose} />}
        {activeTab === 'roles' && <RoleManagement onClose={onClose} />}
      </div>
    </div>
  );
}