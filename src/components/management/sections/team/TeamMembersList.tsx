import React from "react";
import type { StaffMember } from "../../../../types";

interface TeamMembersListProps {
  staff: StaffMember[];
  selectedMembers: string[];
  onMemberToggle: (memberId: string, checked: boolean) => void;
}

export default function TeamMembersList({
  staff,
  selectedMembers,
  onMemberToggle,
}: TeamMembersListProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary-700 mb-1">
        Team Members
      </label>
      <div className="border border-neutral-200 rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto bg-white">
        {staff.map((member) => (
          <label
            key={member.id}
            className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedMembers.includes(member.id)}
              onChange={(e) => onMemberToggle(member.id, e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-primary-700">{member.name}</span>
            <span className="text-sm text-primary-500">({member.role})</span>
          </label>
        ))}
        {staff.length === 0 && (
          <p className="text-center text-primary-500 py-2">
            No available members to add
          </p>
        )}
      </div>
    </div>
  );
}
