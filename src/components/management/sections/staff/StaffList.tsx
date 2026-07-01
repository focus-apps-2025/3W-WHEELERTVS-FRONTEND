import React from "react";
import { Trash2 } from "lucide-react";
import type { StaffMember } from "../../../../types";

interface StaffListProps {
  staff: StaffMember[];
  onDelete: (id: string) => void;
}

export default function StaffList({ staff, onDelete }: StaffListProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden border border-neutral-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-neutral-200">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-primary-700 uppercase tracking-wider">
              Staff Member
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-primary-700 uppercase tracking-wider">
              Contact Info
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-primary-700 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-primary-700 uppercase tracking-wider">
              User ID
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-primary-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-neutral-200">
          {staff.map((member) => (
            <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {member.profilePic ? (
                    <img
                      src={member.profilePic}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                  )}
                  <div className="ml-4">
                    <div className="text-sm font-medium text-primary-900">
                      {member.name}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-primary-900">{member.email}</div>
                <div className="text-sm text-primary-500">{member.mobile}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800">
                  {member.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-500">
                {member.userId}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => onDelete(member.id)}
                  className="text-red-600 hover:text-red-900 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {staff.length === 0 && (
        <div className="text-center py-8 text-primary-500">
          No staff members found
        </div>
      )}
    </div>
  );
}
