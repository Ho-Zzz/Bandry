import { parentPort, workerData } from "worker_threads";
import { ModelsFactory } from "../../../../llm/runtime";
import { SandboxService } from "../../../../sandbox";
import { ResearcherAgent, BashOperatorAgent, WriterAgent } from "../agents/sub-agents";
import type { WorkerConfig, WorkerMessage, AgentResult } from "../agents/types";

/**
 * Sub-agent worker entry point
 * Runs in worker thread, isolated from main process
 */
async function runSubAgent(): Promise<void> {
  if (!parentPort) {
    throw new Error("This script must be run as a worker thread");
  }

  const config = workerData as WorkerConfig;

  try {
    const appConfig = config.appConfig;
    const modelsFactory = new ModelsFactory(appConfig);
    const sandboxService = new SandboxService(appConfig);

    // Create agent based on role
    let agent;
    switch (config.agentRole) {
      case "researcher":
        agent = new ResearcherAgent(appConfig, modelsFactory, {
          workspacePath: config.workspacePath,
          allowedTools: config.allowedTools
        });
        break;

      case "bash_operator":
        agent = new BashOperatorAgent(appConfig, modelsFactory, {
          workspacePath: config.workspacePath,
          allowedTools: config.allowedTools
        }, sandboxService);
        break;

      case "writer":
        agent = new WriterAgent(appConfig, modelsFactory, {
          workspacePath: config.workspacePath,
          allowedTools: config.allowedTools
        });
        break;

      default:
        throw new Error(`Unknown agent role: ${config.agentRole}`);
    }

    // Send progress update
    const progressMessage: WorkerMessage = {
      type: "progress",
      message: `Starting ${config.agentRole} agent`,
      progress: 0
    };
    parentPort.postMessage(progressMessage);

    // Execute agent task
    const result: AgentResult = await agent.execute({
      prompt: config.prompt,
      workspacePath: config.workspacePath,
      writePath: config.writePath
    });

    // Send completion message
    const completedMessage: WorkerMessage = {
      type: "completed",
      result
    };
    parentPort.postMessage(completedMessage);
  } catch (error) {
    // Send failure message
    const failedMessage: WorkerMessage = {
      type: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
    parentPort.postMessage(failedMessage);
  }
}

// Run the worker
runSubAgent().catch((error) => {
  if (parentPort) {
    const failedMessage: WorkerMessage = {
      type: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
    parentPort.postMessage(failedMessage);
  }
  process.exit(1);
});
