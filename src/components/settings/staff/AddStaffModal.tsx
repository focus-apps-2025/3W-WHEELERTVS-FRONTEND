import React from 'react';
import { Camera, X } from 'lucide-react';
import type { StaffMember } from '../../../types';

interface AddStaffModalProps {
  formData: Omit<StaffMember, 'id' | 'userId' | 'password'>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChange: (field: string, value: string) => void;
}

export default function AddStaffModal({
  formData,
  onSubmit,
  onClose,
  onImageUpload,
  onChange,
}: AddStaffModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg my-8">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add Staff Member
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6">
          <div className="space-y-6">
            {/* Profile Picture Upload */}
            <div className="flex justify-center">
              <div className="relative">
                {formData.profilePic ? (
                  <img
                    src={formData.profilePic}
                    alt="Profile preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-700 shadow-lg">
                    <Camera className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-3 cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                  <Camera className="w-5 h-5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => onChange('name', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => onChange('email', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => onChange('mobile', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => onChange('role', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 space-y-3 space-y-reverse sm:space-y-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Staff Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}