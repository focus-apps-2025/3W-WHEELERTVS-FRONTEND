import React from "react";
import { Shield, Trash2, Edit2, CheckCircle2, Lock } from "lucide-react";
import type { Role } from "../../../../types";

interface RoleListProps {
  roles: Role[];
  onDeleteRole: (id: string) => void;
  onEditRole: (role: Role) => void;
}

export default function RoleList({
  roles,
  onDeleteRole,
  onEditRole,
}: RoleListProps) {
  // Helper to parse raw permission strings into clean category tags
  const getRoleSummaryTags = (permissions: string[] = []) => {
    const tags: string[] = [];
    const lowerPerms = permissions.map(p => p.toLowerCase());

    if (lowerPerms.some(p => p.includes("dashboard:view"))) tags.push("Dashboard");
    if (lowerPerms.some(p => p.includes("overall:view"))) tags.push("Overall");
    if (lowerPerms.some(p => p.includes("requests"))) tags.push("Customer Requests");
    if (lowerPerms.some(p => p.includes("hr:"))) tags.push("HR Management");
    if (lowerPerms.some(p => p.includes("attendance"))) tags.push("Attendance");
    if (lowerPerms.some(p => p.includes("admin:manage"))) tags.push("Admin Management");
    
    // Count analytics forms
    const uniqueForms = new Set(permissions.filter(p => p.startsWith("analytics:form:")).map(p => p.split(":")[2]));
    const formsCount = uniqueForms.size;
    if (formsCount > 0) {
      tags.push(`Service Analytics (${formsCount} Form${formsCount > 1 ? "s" : ""})`);
    } else if (lowerPerms.some(p => p.includes("analytics"))) {
      tags.push("Service Analytics");
    }

    return tags;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-900 dark:text-gray-100">
      {roles.map((role) => {
        const summaryTags = getRoleSummaryTags(role.permissions);
        const totalPermissions = role.permissions?.length || 0;

        return (
          <div
            key={role.id}
            className="group relative flex flex-col justify-between bg-white rounded-2xl p-6 border border-neutral-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-blue-500/30 dark:bg-gray-900 dark:hover:border-blue-500/30 transition-all duration-300"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl transition-colors duration-300 group-hover:bg-blue-600 group-hover:text-white">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {role.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {role.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {role.isSystem ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800 rounded-lg">
                      <Lock className="w-3 h-3" />
                      System
                    </span>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => onEditRole(role)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit Role"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteRole(role.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Role"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary tags */}
              <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-gray-850">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Module Access
                  </span>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    {totalPermissions} active node{totalPermissions !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {summaryTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-gray-800 dark:text-neutral-300"
                    >
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      {tag}
                    </span>
                  ))}
                  {summaryTags.length === 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                      No module access permissions selected.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {roles.length === 0 && (
        <div className="col-span-full text-center py-12 border-2 border-dashed border-neutral-200 dark:border-gray-800 rounded-2xl">
          <Shield className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            No roles have been created yet.
          </p>
        </div>
      )}
    </div>
  );
}
