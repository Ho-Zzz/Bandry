import { describe, expect, it } from "vitest";
import { parsePlannerAction } from "../planner-parser";

describe("parsePlannerAction", () => {
  it("parses delegate_sub_tasks with snake_case payload", () => {
    const action = parsePlannerAction(
      JSON.stringify({
        action: "tool",
        tool: "delegate_sub_tasks",
        input: {
          tasks: [
            {
              sub_task_id: "sub_1",
              agent_role: "researcher",
              prompt: "inspect",
              dependencies: [],
              write_path: "staging/result.md"
            }
          ]
        }
      })
    );

    expect(action).toEqual({
      action: "tool",
      tool: "delegate_sub_tasks",
      input: {
        tasks: [
          {
            subTaskId: "sub_1",
            agentRole: "researcher",
            prompt: "inspect",
            dependencies: [],
            writePath: "staging/result.md"
          }
        ]
      },
      reason: undefined
    });
  });
});
