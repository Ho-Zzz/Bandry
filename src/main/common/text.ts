export const normalizeSpaces = (value: string): string => value.replace(/\s+/g, " ").trim();

export const truncate = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}...`;
};
