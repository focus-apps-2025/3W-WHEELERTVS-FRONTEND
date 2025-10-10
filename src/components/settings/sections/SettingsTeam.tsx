import React, { useState, useEffect } from 'react';
import { Plus, Search, UserCircle, Mail } from 'lucide-react';
import type { StaffMember } from '../../../types';
import { staffApi } from '../../../api/storage';
import TeamMemberCard from './team/TeamMemberCard';

interface SettingsTeamProps {
  onClose: () => void;
}

export default function SettingsTeam({ onClose }: SettingsTeamProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    const staffMembers = staffApi.getAll();
    setStaff(staffMembers);
  }, []);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const newStaffMember: StaffMember = {
      id: crypto.randomUUID(),
      name: 'New Staff Member',
      email: inviteEmail,
      role: 'viewer',
    };
    staffApi.save(newStaffMember);
    setStaff([...staff, newStaffMember]);
    setInviteEmail('');
  };

  const handleRemoveStaff = (id: string) => {
    if (window.confirm('Are you sure you want to remove this team member?')) {
      staffApi.delete(id);
      setStaff(staff.filter((member) => member.id !== id));
    }
  };

  const filteredStaff = staff.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <button
          onClick={() => document.getElementById('invite-form')?.focus()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Team Member
        </button>
      </div>

      <div className="space-y-4">
        {filteredStaff.map((member) => (
          <TeamMemberCard
            key={member.id}
            member={member}
            onRemove={() => handleRemoveStaff(member.id)}
          />
        ))}

        {filteredStaff.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            No team members found
          </p>
        )}
      </div>

      <form id="invite-form" onSubmit={handleInvite} className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Invite New Team Member</h4>
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Send Invite
          </button>
        </div>
      </form>
    </div>
  );
}