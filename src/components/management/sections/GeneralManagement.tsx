import React from "react";
import LogoSection from "./general/LogoSection";
import DarkModeSection from "./general/DarkModeSection";
import ProfileSection from "./general/ProfileSection";

export default function GeneralManagement() {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">General Settings</h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure basic system preferences and profile information
        </p>
      </div>

      <div className="space-y-6">
        <ProfileSection />
        <LogoSection />
        <DarkModeSection />
      </div>
    </div>
  );
}
