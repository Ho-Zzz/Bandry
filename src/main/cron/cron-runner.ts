import { randomUUID } from "node:crypto";
import type { ToolPlanningChatAgent } from "../orchestration/chat";
import type { CronJob, CronRunRecord } from "./types";

export class CronRunner {
  constructor(private readonly agent: ToolPlanningChatAgent) {}

  async run(job: CronJob, id?: string): Promise<CronRunRecord> {
    const recordId = id ?? randomUUID();
    const startedAt = Date.now();

    try {
      const result = await this.agent.send(
        {
          message: job.prompt,
          history: [],
          modelProfileId: job.modelProfileId,
          mode: job.mode
        },
        () => {
          // progress updates not forwarded for cron runs
        },
        () => {
          // delta updates not forwarded for cron runs
        }
      );

      return {
        id: recordId,
        jobId: job.id,
        startedAt,
        completedAt: Date.now(),
        status: "completed",
        output: result.reply
      };
    } catch (error) {
      return {
        id: recordId,
        jobId: job.id,
        startedAt,
        completedAt: Date.now(),
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
