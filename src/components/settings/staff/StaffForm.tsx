import React, { useState } from "react";
import { Camera, Upload } from "lucide-react";
import type { StaffMember } from "../../../types";
import {
  generateUserId,
  generateSecurePassword,
} from "../../../utils/staffUtils";

interface StaffFormProps {
  onSubmit: (data: Omit<StaffMember, "id">) => void;
  onCancel: () => void;
}

export default function StaffForm({ onSubmit, onCancel }: StaffFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    role: "viewer" as StaffMember["role"],
    profilePic: "",
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          profilePic: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Generate userId and password
    const userId = generateUserId();
    const password = generateSecurePassword();

    onSubmit({
      ...formData,
      userId,
      password,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="flex items-center justify-center mb-6">
        <div className="relative">
          {formData.profilePic ? (
            <img
              src={formData.profilePic}
              alt="Profile preview"
              className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-lg"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-4 border-white dark:border-gray-700 shadow-lg">
              <Camera className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
          )}
          <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer shadow-lg hover:bg-blue-700 transition-colors">
            <Upload className="w-5 h-5 text-white" />
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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Enter full name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email Address *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Enter email address"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mobile Number *
          </label>
          <input
            type="tel"
            value={formData.mobile}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, mobile: e.target.value }))
            }
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Enter mobile number"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role *
          </label>
          <select
            value={formData.role}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                role: e.target.value as StaffMember["role"],
              }))
            }
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="subadmin">Subadmin</option>
            <option value="inspector">Inspector</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Staff Member
        </button>
      </div>
    </form>
  );
}
