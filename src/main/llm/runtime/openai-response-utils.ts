export const extractMessageText = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const fragments = content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          if (typeof obj.text === "string") {
            return obj.text;
          }
        }

        return "";
      })
      .filter(Boolean);

    return fragments.join("\n").trim();
  }

  return "";
};

export const getErrorMessage = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null) {
    return "Model request failed";
  }

  const root = payload as Record<string, unknown>;
  if (typeof root.error === "string") {
    return root.error;
  }

  if (typeof root.message === "string") {
    return root.message;
  }

  if (typeof root.error === "object" && root.error !== null) {
    const nested = root.error as Record<string, unknown>;
    if (typeof nested.message === "string") {
      return nested.message;
    }
  }

  return "Model request failed";
};

export const isRetryableStatus = (status: number): boolean => {
  if (status === 429) {
    return true;
  }

  return status >= 500;
};
