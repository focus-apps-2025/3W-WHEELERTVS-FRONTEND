import React from "react";
import { useLogo } from "../../../context/LogoContext";
import LogoUpload from "../LogoUpload";
import LanguageSelector from "./general/LanguageSelector";

interface GeneralManagementProps {
  onClose: () => void;
}

export default function GeneralManagement({ onClose }: GeneralManagementProps) {
  const { logo, updateLogo } = useLogo();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
  };

  const handleLogoChange = (newLogo: string) => {
    updateLogo(newLogo);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          Company Branding
        </h3>
        <LogoUpload currentLogo={logo} onLogoChange={handleLogoChange} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          Language & Region
        </h3>
        <LanguageSelector />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}
