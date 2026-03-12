import { buildSection } from "../template-engine";

/**
 * Build the working directory section
 * @param virtualRoot The sandbox virtual root path
 * @param allowedCommands Comma-separated list of allowed shell commands
 */
export const buildWorkingDirectorySection = (virtualRoot: string, allowedCommands: string): string => {
  const content = `- Virtual root: ${virtualRoot}
- Allowed shell commands: ${allowedCommands}
- All file paths must be within the virtual root
- Use list_dir to explore before read_file`;

  return buildSection("working_directory", content);
};
