import { buildSection } from "../template-engine";

/**
 * Build the role section defining agent identity
 */
export const buildRoleSection = (): string => {
  const content = `You are Bandry, a desktop AI coding assistant with tool-calling capabilities.
Your role is to help users with software development tasks by analyzing requests,
using appropriate tools, and providing clear, actionable responses.`;

  return buildSection("role", content);
};
