import React from "react";
import { useLogo } from "../../context/LogoContext";
import LogoUpload from "./LogoUpload";

interface SettingsGeneralProps {
  onClose: () => void;
}

export default function SettingsGeneral({ onClose }: SettingsGeneralProps) {
  const { logo, updateLogo } = useLogo();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
  };

  const handleLogoChange = (newLogo: string) => {
    updateLogo(newLogo);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <LogoUpload currentLogo={logo} onLogoChange={handleLogoChange} />

      <div className="space-y-4">
        <div>
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            Language
          </label>
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            defaultValue="en"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </div>
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
