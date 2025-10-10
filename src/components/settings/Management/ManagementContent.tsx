import React from 'react';
import TeamManagement from './sections/TeamManagement';
import RoleManagement from './sections/RoleManagement';
import GeneralManagement from './sections/GeneralManagement';

interface ManagementContentProps {
  activeTab: string;
  onClose: () => void;
}

export default function ManagementContent({ activeTab, onClose }: ManagementContentProps) {
  return (
    <div className="mt-6">
      {activeTab === 'general' && <GeneralManagement onClose={onClose} />}
      {activeTab === 'team' && <TeamManagement onClose={onClose} />}
      {activeTab === 'roles' && <RoleManagement onClose={onClose} />}
    </div>
  );
}