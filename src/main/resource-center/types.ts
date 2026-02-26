export type ResourceCategory = "document" | "data" | "code" | "config" | "other";

export type ResourceEntry = {
  id: string;
  originalName: string;
  storedName: string;
  category: ResourceCategory;
  summary: string;
  relevance: number;
  sourceTaskId: string;
  createdAt: string;
  tags: string[];
  sizeBytes: number;
  meta: Record<string, unknown>;
};

export type ResourceEntryInput = {
  originalName: string;
  category: ResourceCategory;
  summary: string;
  relevance: number;
  sourceTaskId: string;
  tags: string[];
  sizeBytes: number;
  meta?: Record<string, unknown>;
};

export type CurationJudgment = {
  fileName: string;
  shouldTransfer: boolean;
  category: ResourceCategory;
  summary: string;
  relevance: number;
  tags: string[];
  reason: string;
};

export type CurationJudgmentResult = {
  judgments: CurationJudgment[];
  evaluatedCount: number;
  transferCount: number;
};

export type ResourceQueryFilter = {
  category?: ResourceCategory;
  tags?: string[];
  keywords?: string[];
  minRelevance?: number;
  limit?: number;
};

export type FilePreview = {
  fileName: string;
  sizeBytes: number;
  preview: string;
};
