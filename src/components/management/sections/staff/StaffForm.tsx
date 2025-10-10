import React, { useState } from "react";
import { Camera } from "lucide-react";
import type { StaffMember } from "../../../../types";
import {
  generateUserId,
  generateSecurePassword,
} from "../../../../utils/staffUtils";
import FormField from "../../../common/FormField";

interface StaffFormProps {
  initialData?: StaffMember | null;
  onSubmit: (data: Omit<StaffMember, "id">) => void;
  onCancel: () => void;
}

export default function StaffForm({
  initialData,
  onSubmit,
  onCancel,
}: StaffFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    mobile: initialData?.mobile || "",
    role: initialData?.role || ("viewer" as StaffMember["role"]),
    profilePic: initialData?.profilePic || "",
    userId: initialData?.userId || generateUserId(),
    password: initialData?.password || generateSecurePassword(),
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
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="text-xl font-semibold text-primary-900">
            {initialData ? "Edit Staff Member" : "Add Staff Member"}
          </h3>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                {formData.profilePic ? (
                  <img
                    src={formData.profilePic}
                    alt="Profile preview"
                    className="w-32 h-32 rounded-full object-cover ring-4 ring-white shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center ring-4 ring-white shadow-lg">
                    <Camera className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-primary-600 rounded-full p-3 cursor-pointer hover:bg-primary-700 transition-colors shadow-lg">
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

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Full Name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                className="bg-white"
              />

              <FormField
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                required
                className="bg-white"
              />

              <FormField
                label="Mobile Number"
                type="tel"
                value={formData.mobile}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, mobile: e.target.value }))
                }
                required
                className="bg-white"
              />

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: e.target.value as StaffMember["role"],
                    }))
                  }
                  className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-primary-900"
                  required
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <FormField
                label="User ID"
                type="text"
                value={formData.userId}
                readOnly
                className="bg-gray-100 cursor-not-allowed"
              />

              <FormField
                label="Password"
                type="text"
                value={formData.password}
                readOnly
                className="bg-gray-100 cursor-not-allowed"
              />
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-gray-50">
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2 text-primary-700 bg-white border border-neutral-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {initialData ? "Update" : "Add"} Staff Member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
