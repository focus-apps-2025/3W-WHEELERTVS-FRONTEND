import React from "react";
import { LucideIcon } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface ManagementTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export default function ManagementTabs({
  tabs,
  activeTab,
  onTabChange,
}: ManagementTabsProps) {
  return (
    <div className="border-b border-neutral-200 bg-white">
      <nav className="flex px-6 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`
              flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150
              whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset
              ${
                activeTab === id
                  ? "border-primary-500 text-primary-600 bg-primary-50/50"
                  : "border-transparent text-primary-500 hover:text-primary-700 hover:border-neutral-300"
              }
            `}
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
