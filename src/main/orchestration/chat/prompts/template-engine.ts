/**
 * Simple template engine for variable injection.
 * Replaces {variableName} placeholders with values from the variables object.
 */
export const applyTemplate = (
  template: string,
  variables: Record<string, string | number | boolean>
): string => {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (key in variables) {
      const value = variables[key];
      return String(value);
    }
    // Keep the placeholder if variable not found
    return match;
  });
};

/**
 * Build a section with XML-style tags
 */
export const buildSection = (tagName: string, content: string): string => {
  if (!content.trim()) {
    return "";
  }
  return `<${tagName}>\n${content.trim()}\n</${tagName}>`;
};

/**
 * Join multiple sections with double newlines, filtering out empty sections
 */
export const joinSections = (...sections: string[]): string => {
  return sections.filter((s) => s.trim().length > 0).join("\n\n");
};
