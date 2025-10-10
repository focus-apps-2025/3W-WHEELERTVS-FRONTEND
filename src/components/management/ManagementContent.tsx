import React from "react";
import GeneralManagement from "./sections/GeneralManagement";
import TeamManagement from "./sections/TeamManagement";
import StaffManagement from "./sections/StaffManagement";
import RoleManagement from "./sections/RoleManagement";

interface ManagementContentProps {
  activeTab: string;
}

// Content component mapping for cleaner organization
const CONTENT_COMPONENTS = {
  general: GeneralManagement,
  team: TeamManagement,
  staff: StaffManagement,
  roles: RoleManagement,
} as const;

export default function ManagementContent({
  activeTab,
}: ManagementContentProps) {
  // Get the appropriate component or fallback to General
  const ContentComponent =
    CONTENT_COMPONENTS[activeTab as keyof typeof CONTENT_COMPONENTS] ||
    GeneralManagement;

  return (
    <div className="bg-gray-50 p-6 min-h-[400px]">
      <ContentComponent />
    </div>
  );
}
