/**
 * Settings View Component
 *
 * Main settings page with global configuration management.
 */

import { Settings as SettingsIcon } from "lucide-react";
import { GlobalConfigManager } from "../settings/global-config-manager";

export const Settings = () => {
  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 bg-white">
        <div className="flex items-center gap-3">
          <SettingsIcon size={24} className="text-gray-600" />
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <GlobalConfigManager />
      </div>
    </div>
  );
};
