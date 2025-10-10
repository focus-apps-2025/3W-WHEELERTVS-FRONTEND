import React, { useState, useEffect } from 'react';
import { X, Search, Plus } from 'lucide-react';
import type { StaffMember } from '../../types';
import { staffApi } from '../../api/storage';
import StaffForm from './StaffForm';

interface StaffAssignmentProps {
  responseId: string;
  onAssign: (responseId: string, staffId: string) => void;
  onCancel: () => void;
}

export default function StaffAssignment({
  responseId,
  onAssign,
  onCancel
}: StaffAssignmentProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
    const staffMembers = staffApi.getAll();
    setStaff(staffMembers);
  }, []);

  const handleAddStaff = (newStaff: Omit<StaffMember, 'id'>) => {
    const staffMember: StaffMember = {
      id: crypto.randomUUID(),
      ...newStaff
    };
    staffApi.save(staffMember);
    setStaff([...staff, staffMember]);
    setShowAddForm(false);
  };

  const filteredStaff = staff.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showAddForm || editingStaff) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 flex flex-col" style={{ maxHeight: '90vh' }}>
          <StaffForm
            initialData={editingStaff}
            onSubmit={handleAddStaff}
            onCancel={() => {
              setShowAddForm(false);
              setEditingStaff(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl m-4 flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Assign Staff Member
            </h3>
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="relative flex-1 max-w-sm">
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
              Add Staff
            </button>
          </div>

          <div className="space-y-4">
            {filteredStaff.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {member.profilePic ? (
                    <img
                      src={member.profilePic}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full" />
                  )}
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {member.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {member.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onAssign(responseId, member.id)}
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Assign
                </button>
              </div>
            ))}

            {filteredStaff.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No staff members found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}