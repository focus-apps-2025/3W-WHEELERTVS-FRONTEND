import React, { useState } from "react";
import { Users, ShieldCheck, Settings, UserCog } from "lucide-react";
import ManagementHeader from "./ManagementHeader";
import ManagementTabs from "./ManagementTabs";
import ManagementContent from "./ManagementContent";

// Define tab configuration
const MANAGEMENT_TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "team", label: "Team", icon: Users },
  { id: "staff", label: "Staff", icon: UserCog },
  { id: "roles", label: "Roles", icon: ShieldCheck },
] as const;

type TabId = (typeof MANAGEMENT_TABS)[number]["id"];

export default function Management() {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <ManagementHeader
        title="System Management"
        description="Manage organization structure, teams, roles, and staff access control."
      />

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-neutral-200 dark:border-gray-700 overflow-hidden">
        <ManagementTabs
          tabs={MANAGEMENT_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <ManagementContent activeTab={activeTab} />
      </div>
    </div>
  );
}
