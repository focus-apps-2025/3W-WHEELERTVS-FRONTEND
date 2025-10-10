import React from 'react';
import { UserCircle, Trash2 } from 'lucide-react';
import type { StaffMember } from '../../../../types';

interface MemberListProps {
  members: StaffMember[];
  onRemove: (id: string) => void;
}

export default function MemberList({ members, onRemove }: MemberListProps) {
  return (
    <div className="grid gap-4">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded-full">
              <UserCircle className="w-8 h-8 text-gray-600 dark:text-gray-300" />
            </div>
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
              onClick={() => onRemove(member.id)}
              className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}

      {members.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No members found
        </p>
      )}
    </div>
  );
}