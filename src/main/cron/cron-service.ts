import { randomUUID } from "node:crypto";
import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import type { CronRunEvent, CronCreateInput, CronUpdateInput } from "../../shared/ipc";
import type { CronJob, CronRunRecord } from "./types";
import type { CronStore } from "./cron-store";
import type { CronRunner } from "./cron-runner";

type CronServiceDeps = {
  store: CronStore;
  runner: CronRunner;
  broadcastCronRunEvent: (event: CronRunEvent) => void;
};

export class CronService {
  private readonly tasks = new Map<string, ScheduledTask>();

  constructor(private readonly deps: CronServiceDeps) {}

  async start(): Promise<void> {
    const jobs = await this.deps.store.listJobs();
    for (const job of jobs) {
      if (job.enabled) {
        this.schedule(job);
      }
    }
  }

  stop(): void {
    for (const task of this.tasks.values()) {
      task.destroy();
    }
    this.tasks.clear();
  }

  async listJobs(): Promise<CronJob[]> {
    return this.deps.store.listJobs();
  }

  async create(input: CronCreateInput): Promise<CronJob> {
    const job = await this.deps.store.createJob(input);
    if (job.enabled) {
      this.schedule(job);
    }
    return job;
  }

  async update(input: CronUpdateInput): Promise<CronJob | null> {
    const { id, ...patch } = input;
    const job = await this.deps.store.updateJob(id, patch);
    if (!job) return null;

    this.unschedule(id);
    if (job.enabled) {
      this.schedule(job);
    }
    return job;
  }

  async delete(id: string): Promise<boolean> {
    this.unschedule(id);
    return this.deps.store.deleteJob(id);
  }

  async runNow(id: string): Promise<CronRunRecord> {
    const jobs = await this.deps.store.listJobs();
    const job = jobs.find((j) => j.id === id);
    if (!job) {
      throw new Error(`CronJob ${id} not found`);
    }
    return this.executeJob(job);
  }

  async getHistory(jobId: string, limit?: number): Promise<CronRunRecord[]> {
    return this.deps.store.listRunRecords(jobId, limit);
  }

  private schedule(job: CronJob): void {
    if (!cron.validate(job.schedule)) {
      console.warn(`[CronService] Invalid cron expression for job "${job.name}": ${job.schedule}`);
      return;
    }

    const task = cron.schedule(job.schedule, () => {
      void this.executeJob(job);
    });

    this.tasks.set(job.id, task);

    const nextRun = task.getNextRun();
    if (nextRun) {
      void this.deps.store.updateJob(job.id, { nextRunAt: nextRun.getTime() });
    }
  }

  private unschedule(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.destroy();
      this.tasks.delete(id);
    }
  }

  private async executeJob(job: CronJob): Promise<CronRunRecord> {
    const id = randomUUID();
    const runningRecord: CronRunRecord = {
      id,
      jobId: job.id,
      startedAt: Date.now(),
      status: "running"
    };

    this.deps.broadcastCronRunEvent({ jobId: job.id, record: runningRecord });

    const record = await this.deps.runner.run(job, id);

    await this.deps.store.appendRunRecord(record);
    await this.deps.store.updateJob(job.id, { lastRunAt: record.startedAt });

    this.deps.broadcastCronRunEvent({ jobId: job.id, record });

    return record;
  }
}
