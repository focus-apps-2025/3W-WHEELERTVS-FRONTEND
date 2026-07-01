import React, { useState, useEffect } from 'react';
import { Plus, Search, UserCircle, Mail } from 'lucide-react';
import type { StaffMember } from '../../../types';
import { staffApi } from '../../../api/storage';
import StaffForm from '../../staff/StaffForm';

interface StaffManagementProps {
  onClose: () => void;
}

export default function StaffManagement({ onClose }: StaffManagementProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const staffMembers = staffApi.getAll();
    setStaff(staffMembers);
  }, []);

  const handleAddStaff = (newStaff: Omit<StaffMember, 'id'>) => {
    const staffMember: StaffMember = {
      id: crypto.randomUUID(),
      ...newStaff,
    };
    staffApi.save(staffMember);
    setStaff([...staff, staffMember]);
    setShowAddForm(false);
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
    <div className="h-full flex flex-col">
      {/* Search and Add Button */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
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
          onClick={() => setShowAddForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ml-4"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff Member
        </button>
      </div>

      {/* Staff List - Scrollable */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        <div className="grid gap-4">
          {filteredStaff.map((member) => (
            <div
              key={member.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {member.profilePic ? (
                    <img
                      src={member.profilePic}
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <UserCircle className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                      {member.name}
                    </h4>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Mail className="w-4 h-4 mr-1" />
                      {member.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                    {member.role}
                  </span>
                  <button
                    onClick={() => handleRemoveStaff(member.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredStaff.length === 0 && (
            <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <UserCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm ? 'No staff members found' : 'No staff members added yet'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
            <StaffForm
              onSubmit={handleAddStaff}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}