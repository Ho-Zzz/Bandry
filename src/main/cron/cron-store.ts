import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CronJob, CronRunRecord } from "./types";

const JOBS_FILE = "jobs.json";
const HISTORY_FILE = "history.jsonl";

export class CronStore {
  constructor(private readonly cronDir: string) {}

  private get jobsPath(): string {
    return path.join(this.cronDir, JOBS_FILE);
  }

  private get historyPath(): string {
    return path.join(this.cronDir, HISTORY_FILE);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.cronDir, { recursive: true });
  }

  async listJobs(): Promise<CronJob[]> {
    try {
      const raw = await fs.readFile(this.jobsPath, "utf-8");
      return JSON.parse(raw) as CronJob[];
    } catch {
      return [];
    }
  }

  private async writeJobs(jobs: CronJob[]): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.jobsPath, JSON.stringify(jobs, null, 2), "utf-8");
  }

  async createJob(input: Omit<CronJob, "id" | "createdAt" | "updatedAt">): Promise<CronJob> {
    const jobs = await this.listJobs();
    const now = Date.now();
    const job: CronJob = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    jobs.push(job);
    await this.writeJobs(jobs);
    return job;
  }

  async updateJob(id: string, patch: Partial<Omit<CronJob, "id" | "createdAt">>): Promise<CronJob | null> {
    const jobs = await this.listJobs();
    const index = jobs.findIndex((j) => j.id === id);
    if (index === -1) {
      return null;
    }
    const updated: CronJob = { ...jobs[index], ...patch, updatedAt: Date.now() };
    jobs[index] = updated;
    await this.writeJobs(jobs);
    return updated;
  }

  async deleteJob(id: string): Promise<boolean> {
    const jobs = await this.listJobs();
    const filtered = jobs.filter((j) => j.id !== id);
    if (filtered.length === jobs.length) {
      return false;
    }
    await this.writeJobs(filtered);
    return true;
  }

  async appendRunRecord(record: CronRunRecord): Promise<void> {
    await this.ensureDir();
    const line = JSON.stringify(record) + "\n";
    await fs.appendFile(this.historyPath, line, "utf-8");
  }

  async listRunRecords(jobId: string, limit = 20): Promise<CronRunRecord[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.historyPath, "utf-8");
    } catch {
      return [];
    }

    const records: CronRunRecord[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const record = JSON.parse(trimmed) as CronRunRecord;
        if (record.jobId === jobId) {
          records.push(record);
        }
      } catch {
        // skip malformed lines
      }
    }

    return records.slice(-limit);
  }
}
