export type CronJob = {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  schedule: string;
  enabled: boolean;
  modelProfileId?: string;
  workspacePath?: string;
  mode?: "default" | "thinking" | "subagents";
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
};

export type CronRunRecord = {
  id: string;
  jobId: string;
  startedAt: number;
  completedAt?: number;
  status: "running" | "completed" | "failed";
  output?: string;
  error?: string;
};
