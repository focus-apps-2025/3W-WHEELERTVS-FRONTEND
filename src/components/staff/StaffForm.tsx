import React, { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import type { StaffMember, Role } from '../../types';
import { generateUserId, generateSecurePassword } from '../../utils/staffUtils';
import FormField from './form/FormField';
import { rolesApi } from '../../api/roles';

interface StaffFormProps {
  initialData?: StaffMember | null;
  onSubmit: (data: Omit<StaffMember, 'id'>) => void;
  onCancel: () => void;
}

export default function StaffForm({ initialData, onSubmit, onCancel }: StaffFormProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    mobile: initialData?.mobile || '',
    role: initialData?.role || 'viewer' as StaffMember['role'],
    profilePic: initialData?.profilePic || '',
    userId: initialData?.userId || generateUserId(),
    password: initialData?.password || generateSecurePassword(),
  });

  useEffect(() => {
    const savedRoles = rolesApi.getAll();
    setRoles(savedRoles);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profilePic: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          {initialData ? 'Edit Staff Member' : 'Add Staff Member'}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          <div className="flex justify-center">
            <div className="relative">
              {formData.profilePic ? (
                <img
                  src={formData.profilePic}
                  alt="Profile preview"
                  className="w-32 h-32 rounded-full object-cover ring-4 ring-white dark:ring-gray-700 shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-700 shadow-lg">
                  <Camera className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                <Camera className="w-5 h-5 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Full Name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              className="bg-gray-50 dark:bg-gray-700"
            />

            <FormField
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              className="bg-gray-50 dark:bg-gray-700"
            />

            <FormField
              label="Mobile Number"
              type="tel"
              value={formData.mobile}
              onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
              required
              className="bg-gray-50 dark:bg-gray-700"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as StaffMember['role'] }))}
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              >
                {roles.length > 0 ? (
                  roles.map(role => (
                    <option key={role.id} value={role.name.toLowerCase()}>
                      {role.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </>
                )}
              </select>
            </div>

            <FormField
              label="User ID"
              type="text"
              value={formData.userId}
              readOnly
              className="bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
            />

            <FormField
              label="Password"
              type="text"
              value={formData.password}
              readOnly
              className="bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
            />
          </div>
        </form>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {initialData ? 'Update' : 'Add'} Staff Member
          </button>
        </div>
      </div>
    </div>
  );
}