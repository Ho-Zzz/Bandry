import type { NetworkMode } from "./types";

const KNOWN_NETWORK_MODES = new Set(["auto", "online", "offline"]);

export const asObject = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

export const toStringValue = (raw: unknown): string | undefined => {
  if (typeof raw !== "string") {
    return undefined;
  }

  const value = raw.trim();
  if (!value) {
    return "";
  }

  return value;
};

export const toBooleanValue = (raw: unknown): boolean | undefined => {
  if (typeof raw === "boolean") {
    return raw;
  }

  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return undefined;
};

export const toNumberValue = (raw: unknown): number | undefined => {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === "string") {
    const value = Number(raw);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};

export const toStringListValue = (raw: unknown): string[] | undefined => {
  if (Array.isArray(raw)) {
    const values = raw.filter((item): item is string => typeof item === "string").map((item) => item.trim());
    return values.filter(Boolean);
  }

  if (typeof raw === "string") {
    const values = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return values;
  }

  return undefined;
};

export const toNetworkMode = (raw: unknown): NetworkMode | undefined => {
  if (typeof raw !== "string") {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (!KNOWN_NETWORK_MODES.has(normalized)) {
    return undefined;
  }

  return normalized as NetworkMode;
};
