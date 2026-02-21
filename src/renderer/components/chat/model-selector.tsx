/**
 * Model Selector Component
 *
 * Dropdown for selecting active LLM provider/model
 */

import { useState, useEffect } from "react";
import { Select, SelectItem, Chip } from "@heroui/react";
import { Zap } from "lucide-react";
import type { RuntimeConfigSummary } from "../../../shared/ipc";

type ModelSelectorProps = {
  value?: string;
  onChange: (profileId: string) => void;
  className?: string;
};

export const ModelSelector = ({ value, onChange, className }: ModelSelectorProps) => {
  const [configSummary, setConfigSummary] = useState<RuntimeConfigSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setIsLoading(true);
      const result = await window.api.getConfigSummary();
      setConfigSummary(result);
    } catch (error) {
      console.error("Failed to load providers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Zap size={16} className="animate-pulse" />
        <span>Loading models...</span>
      </div>
    );
  }

  const profiles = (configSummary?.modelProfiles ?? []).filter((profile) => profile.enabled);
  if (profiles.length === 0) {
    return (
      <Chip size="sm" color="warning" variant="flat">
        No model profiles
      </Chip>
    );
  }

  return (
    <Select
      size="sm"
      label="Model"
      placeholder="Select a model"
      selectedKeys={value ? [value] : []}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      classNames={{
        trigger: "h-10",
        value: "text-sm"
      }}
    >
      {profiles.map((profile) => (
        <SelectItem
          key={profile.id}
          textValue={`${profile.name}`}
        >
          <div className="flex items-center gap-2">
            <Zap size={14} />
            <span className="font-medium">{profile.name}</span>
            <span className="text-xs text-gray-500">
              {profile.provider}/{profile.model}
            </span>
          </div>
        </SelectItem>
      ))}
    </Select>
  );
};
