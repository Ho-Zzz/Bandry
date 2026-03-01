import path from "node:path";
import type { AppPaths } from "./types";

const toOptionalTrimmedString = (raw: string | undefined): string | undefined => {
  if (typeof raw !== "string") {
    return undefined;
  }
  const value = raw.trim();
  return value.length > 0 ? value : undefined;
};

const resolvePathValue = (raw: string | undefined, fallback: string, baseDir: string = process.cwd()): string => {
  const candidate = toOptionalTrimmedString(raw);
  if (!candidate) {
    return path.resolve(fallback);
  }
  return path.isAbsolute(candidate) ? path.normalize(candidate) : path.resolve(baseDir, candidate);
};

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
  env: NodeJS.ProcessEnv;
};

export const resolvePathPlan = (input: ResolvePathPlanInput): ResolvedPathPlan => {
  const projectRoot = path.resolve(input.cwd);
  const userHome = path.resolve(input.userHome);

  const bandryHome = resolvePathValue(input.env.BANDRY_HOME, path.join(userHome, ".bandry"), userHome);
  const configDir = resolvePathValue(input.env.BANDRY_CONFIG_DIR, path.join(bandryHome, "config"), bandryHome);
  const logsDir = resolvePathValue(input.env.BANDRY_LOG_DIR, path.join(bandryHome, "logs"), bandryHome);
  const resourcesDir = resolvePathValue(input.env.BANDRY_RESOURCES_DIR, path.join(bandryHome, "resources"), bandryHome);
  const pluginsDir = resolvePathValue(input.env.BANDRY_PLUGINS_DIR, path.join(bandryHome, "plugins"), bandryHome);
  const workspacesDir = resolvePathValue(
    input.env.BANDRY_WORKSPACES_DIR,
    path.join(bandryHome, "workspaces"),
    bandryHome
  );
  const workspaceDir = resolvePathValue(input.env.BANDRY_WORKSPACE_DIR, workspacesDir, bandryHome);
  const traceDir = resolvePathValue(input.env.BANDRY_TRACE_DIR, path.join(bandryHome, "traces"), bandryHome);
  const skillsDir = resolvePathValue(input.env.BANDRY_SKILLS_DIR, path.join(bandryHome, "skills"), bandryHome);
  const soulDir = resolvePathValue(input.env.BANDRY_SOUL_DIR, path.join(bandryHome, "soul"), bandryHome);
  const databasePath = resolvePathValue(input.env.BANDRY_DB_PATH, path.join(configDir, "bandry.db"), configDir);
  const auditLogPath = resolvePathValue(input.env.BANDRY_AUDIT_LOG_PATH, path.join(logsDir, "model-audit.log"), logsDir);
  const sandboxAuditLogPath = resolvePathValue(
    input.env.BANDRY_SANDBOX_AUDIT_LOG_PATH,
    path.join(logsDir, "sandbox-audit.log"),
    logsDir
  );

  const defaultProjectConfigPath = path.join(projectRoot, ".bandry", "config.json");
  const legacyProjectConfigPath = path.join(projectRoot, "config.json");
  const projectConfigPath = resolvePathValue(input.env.BANDRY_PROJECT_CONFIG_PATH, defaultProjectConfigPath, projectRoot);

  const defaultUserConfigPath = path.join(configDir, "config.json");
  const legacyUserConfigPath = path.join(userHome, ".config", "bandry", "config.json");
  const userConfigPath = resolvePathValue(input.env.BANDRY_USER_CONFIG_PATH, defaultUserConfigPath, configDir);

  const dotenvPath = resolvePathValue(input.env.BANDRY_DOTENV_PATH, path.join(projectRoot, ".env"), projectRoot);

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
      databasePath,
      dotenvPath
    },
    projectLayerPaths: input.env.BANDRY_PROJECT_CONFIG_PATH
      ? [projectConfigPath]
      : unique([legacyProjectConfigPath, projectConfigPath]),
    userLayerPaths: input.env.BANDRY_USER_CONFIG_PATH ? [userConfigPath] : unique([legacyUserConfigPath, userConfigPath])
  };
};
