import React from "react";
import { useLogo } from "../../context/LogoContext";
import { useDataScope, DATA_SCOPE_OPTIONS, DataScopeOption } from "../../context/DataScopeContext";
import LogoUpload from "./LogoUpload";
import { Calendar, ShieldAlert } from "lucide-react";

interface SettingsGeneralProps {
  onClose: () => void;
}

export default function SettingsGeneral({ onClose }: SettingsGeneralProps) {
  const { logo, updateLogo } = useLogo();
  const { dataScope, updateDataScope, getDataScopeLabel } = useDataScope();

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

      {/* ── Default Data Display Scope Settings ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-850 p-4 rounded-xl border border-blue-100 dark:border-gray-700 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white text-base">
            Default Data Display Scope
          </h4>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          Select the time window for viewing data across the entire platform. Once enabled, all dashboards, analytics, responses, and exported reports will be strictly restricted to your chosen scope window.
        </p>

        <div>
          <select
            value={dataScope}
            onChange={(e) => updateDataScope(e.target.value as DataScopeOption)}
            className="w-full px-3 py-2.5 border border-blue-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white text-sm font-semibold shadow-sm"
          >
            {DATA_SCOPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {dataScope !== "overall" ? (
          <div className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Scope Mode Active ({getDataScopeLabel(dataScope)}):</strong> The entire website will display data created within this timeframe only. Even if filters request broader ranges (e.g. 3 months), data remains strictly capped to <strong>{getDataScopeLabel(dataScope)}</strong>.
            </span>
          </div>
        ) : (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
            Currently showing all-time overall data without time restrictions.
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-gray-700 dark:text-gray-300 mb-2 font-medium">
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

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}
