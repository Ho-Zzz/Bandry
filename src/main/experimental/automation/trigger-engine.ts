import { EventEmitter } from "events";

/**
 * Trigger definition
 * Defines A → B task dependency
 */
export type Trigger = {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  condition?: (output: TaskOutput) => boolean;
  transformOutput?: (output: TaskOutput) => unknown;
};

/**
 * Task output
 */
export type TaskOutput = {
  taskId: string;
  success: boolean;
  output: string;
  artifacts?: string[];
  error?: string;
};

/**
 * Trigger engine
 * Manages A → B task triggers and automation
 */
export class TriggerEngine extends EventEmitter {
  private triggers: Map<string, Trigger[]> = new Map();

  /**
   * Register a trigger
   * When sourceTask completes, targetTask is triggered
   */
  registerTrigger(trigger: Trigger): void {
    const triggers = this.triggers.get(trigger.sourceTaskId) || [];
    triggers.push(trigger);
    this.triggers.set(trigger.sourceTaskId, triggers);
  }

  /**
   * Unregister a trigger
   */
  unregisterTrigger(triggerId: string): boolean {
    for (const [sourceTaskId, triggers] of this.triggers.entries()) {
      const index = triggers.findIndex((t) => t.id === triggerId);
      if (index !== -1) {
        triggers.splice(index, 1);
        if (triggers.length === 0) {
          this.triggers.delete(sourceTaskId);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Handle task completion
   * Triggers dependent tasks
   */
  async onTaskCompleted(output: TaskOutput): Promise<void> {
    const triggers = this.triggers.get(output.taskId);
    if (!triggers || triggers.length === 0) {
      return;
    }

    for (const trigger of triggers) {
      // Check condition if specified
      if (trigger.condition && !trigger.condition(output)) {
        continue;
      }

      // Transform output if specified
      const transformedOutput = trigger.transformOutput
        ? trigger.transformOutput(output)
        : output;

      // Emit trigger event
      this.emit("trigger", {
        triggerId: trigger.id,
        sourceTaskId: trigger.sourceTaskId,
        targetTaskId: trigger.targetTaskId,
        output: transformedOutput
      });
    }
  }

  /**
   * Get triggers for a task
   */
  getTriggersForTask(taskId: string): Trigger[] {
    return this.triggers.get(taskId) || [];
  }

  /**
   * Get all triggers
   */
  getAllTriggers(): Trigger[] {
    const allTriggers: Trigger[] = [];
    for (const triggers of this.triggers.values()) {
      allTriggers.push(...triggers);
    }
    return allTriggers;
  }

  /**
   * Clear all triggers
   */
  clear(): void {
    this.triggers.clear();
    this.removeAllListeners();
  }
}
