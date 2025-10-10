import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Mail, Search, UserCircle } from 'lucide-react';
import type { StaffMember } from '../../../../types';
import { staffApi } from '../../../../api/storage';
import SearchInput from '../components/SearchInput';
import MemberList from '../components/MemberList';
import InviteForm from '../components/InviteForm';

interface GeneralManagementProps {
  onClose: () => void;
}

export default function GeneralManagement({ onClose }: GeneralManagementProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const staffMembers = staffApi.getAll();
    setStaff(staffMembers);
  }, []);

  const handleAddStaff = (email: string) => {
    const newStaffMember: StaffMember = {
      id: crypto.randomUUID(),
      name: 'New Staff Member',
      email,
      role: 'viewer',
      avatar: `https://ui-avatars.com/api/?name=New+Staff`,
    };
    staffApi.save(newStaffMember);
    setStaff([...staff, newStaffMember]);
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
        <SearchInput value={searchTerm} onChange={setSearchTerm} />
        <button
          onClick={() => document.getElementById('invite-form')?.focus()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Member
        </button>
      </div>

      <MemberList members={filteredStaff} onRemove={handleRemoveStaff} />
      <InviteForm onSubmit={handleAddStaff} />
    </div>
  );
}