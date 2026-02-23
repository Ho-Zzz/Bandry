/**
 * Workflows View Component
 * 
 * Displays a list of automation workflows with visual step visualization.
 * Shows workflow triggers, last run time, and step-by-step progress indicators.
 */

import {
  Zap,
  Play,
  FileText,
  ArrowRight,
  PauseCircle,
  Clock,
  Calendar,
  Folder,
  Plus,
  MoreVertical,
} from 'lucide-react';
import { clsx } from 'clsx';
import { MOCK_WORKFLOWS } from '../../data/mock';
import type { Workflow, WorkflowStep } from '../../types/app';

/**
 * TriggerIcon Component
 * Displays appropriate icon based on workflow trigger type
 */
const TriggerIcon = ({
  trigger,
  size = 16,
}: {
  trigger: Workflow['trigger'];
  size?: number;
}) => {
  const icons = {
    manual: Play,
    daily: Calendar,
    file_change: Folder,
  };

  const Icon = icons[trigger];
  return <Icon size={size} />;
};

/**
 * TriggerLabel Component
 * Returns human-readable label for trigger type
 */
const TriggerLabel = ({ trigger }: { trigger: Workflow['trigger'] }) => {
  const labels = {
    manual: 'Manual',
    daily: 'Daily',
    file_change: 'On File Change',
  };

  return <span>{labels[trigger]}</span>;
};

/**
 * WorkflowStepItem Component
 * Individual step in the workflow visualization
 */
const WorkflowStepItem = ({
  step,
  isLast,
}: {
  step: WorkflowStep;
  isLast: boolean;
}) => (
  <div className="flex items-center">
    <div
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
        step.type === 'action'
          ? 'bg-blue-50 text-blue-700'
          : 'bg-amber-50 text-amber-700'
      )}
    >
      {step.type === 'action' ? (
        <Zap size={14} />
      ) : (
        <PauseCircle size={14} />
      )}
      <span className="font-medium">{step.name}</span>
    </div>
    {!isLast && (
      <ArrowRight size={16} className="mx-2 text-gray-300" />
    )}
  </div>
);

/**
 * WorkflowCard Component
 * Individual workflow card with full details
 */
const WorkflowCard = ({ workflow }: { workflow: Workflow }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all">
    {/* Header */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <Zap className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
          <p className="text-sm text-gray-500">{workflow.description}</p>
        </div>
      </div>
      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
        <MoreVertical size={18} />
      </button>
    </div>

    {/* Steps Visualization */}
    <div className="mb-4 overflow-x-auto">
      <div className="flex items-center gap-0 pb-2">
        {workflow.steps.map((step, index) => (
          <WorkflowStepItem
            key={step.id}
            step={step}
            isLast={index === workflow.steps.length - 1}
          />
        ))}
      </div>
    </div>

    {/* Footer */}
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <TriggerIcon trigger={workflow.trigger} size={14} />
          <TriggerLabel trigger={workflow.trigger} />
        </div>
        {workflow.lastRun && (
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            <span>Last run {workflow.lastRun}</span>
          </div>
        )}
      </div>
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
        <Play size={14} />
        Run
      </button>
    </div>
  </div>
);

/**
 * AddWorkflowCard Component
 * Placeholder for creating new workflows
 */
const AddWorkflowCard = () => (
  <button className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50/50 transition-all min-h-[200px]">
    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
      <Plus size={24} />
    </div>
    <span className="font-medium">Create Workflow</span>
    <span className="text-sm mt-1">Build a new automation</span>
  </button>
);

/**
 * Workflows Component
 * 
 * Displays all configured automation workflows.
 * Each workflow shows its steps, trigger type, and last run status.
 * 
 * @example
 * ```tsx
 * <Workflows />
 * ```
 */
export const Workflows = () => {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Automations</h1>
          <p className="text-gray-500">
            Manage and monitor your automated AI workflows
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          Create Workflow
        </button>
      </div>

      {/* Workflows Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MOCK_WORKFLOWS.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} />
        ))}
        <AddWorkflowCard />
      </div>

      {/* Tips Section */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              Getting Started with Workflows
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              Workflows allow you to automate multi-step processes involving your AI employees.
              Each step can be an action performed by an agent or a review checkpoint.
            </p>
            <div className="flex items-center gap-4 text-sm text-blue-600">
              <span className="flex items-center gap-1.5">
                <Zap size={14} />
                Action Steps
              </span>
              <span className="flex items-center gap-1.5">
                <PauseCircle size={14} />
                Review Checkpoints
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
