import React, { useState } from 'react';
import { Users, ShieldCheck, Settings } from 'lucide-react';
import ManagementHeader from './ManagementHeader';
import ManagementTabs from './ManagementTabs';
import ManagementContent from './ManagementContent';

interface ManagementProps {
  onClose: () => void;
}

export default function Management({ onClose }: ManagementProps) {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'General Management', icon: Settings },
    { id: 'team', label: 'Team Management', icon: Users },
    { id: 'roles', label: 'Role Management', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <ManagementHeader 
        title="Management"
        description="Manage your organization's structure, teams, and roles to control access to different features of the system."
      />
      
      <ManagementTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <ManagementContent
        activeTab={activeTab}
        onClose={onClose}
      />
    </div>
  );
}