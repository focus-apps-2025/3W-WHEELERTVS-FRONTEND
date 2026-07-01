import React, { useState } from "react";
import { User, Mail, Phone, Save, X, Key, UserCheck } from "lucide-react";
import type { Profile } from "../types";

interface ProfileEditProps {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onCancel: () => void;
}

export default function ProfileEdit({
  profile,
  onSave,
  onCancel,
}: ProfileEditProps) {
  const [formData, setFormData] = useState<Profile>(profile);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <User className="w-4 h-4" />
            <span>Name</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <UserCheck className="w-4 h-4" />
            <span>Username</span>
          </label>
          <input
            type="text"
            value={formData.username || ""}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
            placeholder="Enter username"
          />
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Key className="w-4 h-4" />
            <span>User ID</span>
          </label>
          <input
            type="text"
            value={formData.userId}
            className="w-full px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed font-mono"
            disabled
          />
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Mail className="w-4 h-4" />
            <span>Email</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Phone className="w-4 h-4" />
            <span>Phone</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </button>
      </div>
    </form>
  );
}
