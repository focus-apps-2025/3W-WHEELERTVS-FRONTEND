import React from 'react';
import { Trash2 } from 'lucide-react';
import type { StaffMember } from '../../../../types';

interface TeamMemberCardProps {
  member: StaffMember;
  onRemove: () => void;
}

export default function TeamMemberCard({ member, onRemove }: TeamMemberCardProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex items-center space-x-4">
        <img
          src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`}
          alt={member.name}
          className="w-10 h-10 rounded-full"
        />
        <div>
          <h5 className="text-gray-900 dark:text-white font-medium">
            {member.name}
          </h5>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {member.email}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {member.role}
        </span>
        <button
          onClick={onRemove}
          className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}