import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../../../../config";
import { DAGScheduler } from "../dag-scheduler";
import type { DAGPlan } from "../../agents/types";

describe("DAGScheduler", () => {
  it("marks dependent tasks as failed when dependency fails", async () => {
    const workerPool = {
      executeTask: vi.fn(async (config: { workerId: string }) => {
        if (config.workerId === "sub_1") {
          throw new Error("sub_1 failed");
        }

        return {
          success: true,
          output: "ok"
        };
      }),
      getAvailableSlots: vi.fn(() => 3)
    };

    const scheduler = new DAGScheduler(workerPool as never);

    const plan: DAGPlan = {
      tasks: [
        {
          subTaskId: "sub_1",
          agentRole: "researcher",
          prompt: "task1",
          dependencies: []
        },
        {
          subTaskId: "sub_2",
          agentRole: "writer",
          prompt: "task2",
          dependencies: ["sub_1"]
        }
      ]
    };

    const appConfig = {
      sandbox: {
        allowedCommands: []
      }
    } as unknown as AppConfig;

    const results = await scheduler.scheduleDAG(plan, "/tmp/workspace", appConfig);

    expect(workerPool.executeTask).toHaveBeenCalledTimes(1);
    expect(results.get("sub_1")?.success).toBe(false);
    expect(results.get("sub_2")?.success).toBe(false);
    expect(results.get("sub_2")?.error).toContain("Blocked by failed dependencies");
  });
});
