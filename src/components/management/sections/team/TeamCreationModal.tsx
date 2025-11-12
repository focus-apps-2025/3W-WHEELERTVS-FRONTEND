import React, { useState } from "react";
import { Users, X, Palette } from "lucide-react";
import type { StaffMember } from "../../../../types";
import { staffApi } from "../../../../api/storage";
import TeamMembersList from "./TeamMembersList";
import TeamColorPicker from "./TeamColorPicker";
import FormField from "../../../common/FormField";

interface TeamCreationModalProps {
  onClose: () => void;
  onSubmit: (team: any) => void;
}

export default function TeamCreationModal({
  onClose,
  onSubmit,
}: TeamCreationModalProps) {
  const [staff] = useState<StaffMember[]>(() => staffApi.getAll());
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    members: [] as string[],
    leaderId: "",
    color: "blue",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary-600" />
            <h3 className="text-xl font-semibold text-primary-900">
              Create New Team
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-primary-500 hover:text-primary-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-4">
              <FormField
                label="Team Name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter team name"
                required
              />

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-primary-900"
                  placeholder="Enter team description"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1">
                  Team Leader
                </label>
                <select
                  value={formData.leaderId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      leaderId: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-primary-900"
                  required
                >
                  <option value="">Select a team leader</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role})
                    </option>
                  ))}
                </select>
              </div>

              <TeamMembersList
                staff={staff.filter(
                  (member) => member.id !== formData.leaderId
                )}
                selectedMembers={formData.members}
                onMemberToggle={(memberId, checked) => {
                  setFormData((prev) => ({
                    ...prev,
                    members: checked
                      ? [...prev.members, memberId]
                      : prev.members.filter((id) => id !== memberId),
                  }));
                }}
              />

              <TeamColorPicker
                selectedColor={formData.color}
                onColorChange={(color) =>
                  setFormData((prev) => ({ ...prev, color }))
                }
              />
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-primary-700 bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create Team
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
