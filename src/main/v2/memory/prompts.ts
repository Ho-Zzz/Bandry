export const buildFactExtractionPrompt = (maxFacts: number): string => {
  return `You are a fact extraction system. Extract key facts from the conversation.

Rules:
1. Extract only important, actionable facts
2. Ignore pleasantries, greetings, and meta-discussion
3. Focus on: preferences, decisions, technical details, requirements, constraints
4. Each fact should be self-contained and clear
5. Assign relevant tags to each fact
6. Assign confidence score (0.0-1.0) based on clarity and importance
7. Extract up to ${maxFacts} facts

Return a JSON array of facts in this format:
[
  {
    "content": "User prefers TypeScript over JavaScript",
    "tags": ["preference", "language"],
    "confidence": 0.9
  },
  {
    "content": "Project uses Vite for bundling",
    "tags": ["tooling", "build"],
    "confidence": 1.0
  }
]

Only return the JSON array, no other text.`;
};

export const buildSummaryPrompt = (type: "outline" | "summary"): string => {
  return type === "outline"
    ? "Create a concise outline of the key points:"
    : "Create a brief summary (2-3 sentences):";
};
