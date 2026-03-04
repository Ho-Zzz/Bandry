import path from "node:path";
import type { AppPaths } from "./types";

const unique = (values: string[]): string[] => {
  return Array.from(new Set(values.map((value) => path.resolve(value))));
};

export type ResolvedPathPlan = {
  paths: AppPaths;
  projectLayerPaths: string[];
  userLayerPaths: string[];
};

type ResolvePathPlanInput = {
  cwd: string;
  userHome: string;
};

export const resolvePathPlan = (input: ResolvePathPlanInput): ResolvedPathPlan => {
  const projectRoot = path.resolve(input.cwd);
  const userHome = path.resolve(input.userHome);

  const bandryHome = path.join(userHome, ".bandry");
  const configDir = path.join(bandryHome, "config");
  const logsDir = path.join(bandryHome, "logs");
  const resourcesDir = path.join(bandryHome, "resources");
  const pluginsDir = path.join(bandryHome, "plugins");
  const workspacesDir = path.join(bandryHome, "workspaces");
  const workspaceDir = workspacesDir;
  const traceDir = path.join(bandryHome, "traces");
  const skillsDir = path.join(bandryHome, "skills");
  const soulDir = path.join(bandryHome, "soul");
  const databasePath = path.join(configDir, "bandry.db");
  const auditLogPath = path.join(logsDir, "model-audit.log");
  const sandboxAuditLogPath = path.join(logsDir, "sandbox-audit.log");

  const defaultProjectConfigPath = path.join(projectRoot, ".bandry", "config.json");
  const legacyProjectConfigPath = path.join(projectRoot, "config.json");
  const projectConfigPath = defaultProjectConfigPath;

  const defaultUserConfigPath = path.join(configDir, "config.json");
  const legacyUserConfigPath = path.join(userHome, ".config", "bandry", "config.json");
  const userConfigPath = defaultUserConfigPath;

  return {
    paths: {
      projectRoot,
      bandryHome,
      configDir,
      logsDir,
      workspaceDir,
      workspacesDir,
      resourcesDir,
      pluginsDir,
      traceDir,
      skillsDir,
      soulDir,
      projectConfigPath,
      userConfigPath,
      auditLogPath,
      sandboxAuditLogPath,
      databasePath
    },
    projectLayerPaths: unique([legacyProjectConfigPath, projectConfigPath]),
    userLayerPaths: unique([legacyUserConfigPath, userConfigPath])
  };
};
