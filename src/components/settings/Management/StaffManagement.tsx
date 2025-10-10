import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Mail, Search, UserCircle } from 'lucide-react';
import type { StaffMember } from '../../../types';
import { staffApi } from '../../../api/storage';

interface StaffManagementProps {
  onClose: () => void;
}

export default function StaffManagement({ onClose }: StaffManagementProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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
      avatar: `https://ui-avatars.com/api/?name=New+Staff`,
    };
    staffApi.save(newStaffMember);
    setStaff([...staff, newStaffMember]);
    setInviteEmail('');
  };

  const handleRemoveStaff = (id: string) => {
    if (window.confirm('Are you sure you want to remove this staff member?')) {
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
            placeholder="Search staff members..."
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
          Add Staff Member
        </button>
      </div>

      <div className="grid gap-4">
        {filteredStaff.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded-full">
                <UserCircle className="w-8 h-8 text-gray-600 dark:text-gray-300" />
              </div>
              <div>
                <h5 className="text-gray-900 dark:text-white font-medium">
                  {member.name}
                </h5>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {member.email}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {member.role}
              </span>
              <button
                onClick={() => handleRemoveStaff(member.id)}
                className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        {filteredStaff.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No staff members found
          </p>
        )}
      </div>

      <form id="invite-form" onSubmit={handleInvite} className="mt-6 p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Add New Staff Member</h4>
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
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Staff
          </button>
        </div>
      </form>
    </div>
  );
}