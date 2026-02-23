/**
 * Home View Component
 * 
 * Dashboard view displaying recent activity, workflow status, and quick actions.
 * Shows attention cards for tasks requiring human review.
 */

import {
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  Activity,
  Users,
  Zap,
  Plus,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Task } from '../../types/app';
import { TaskStatus } from '../../types/app';

interface HomeProps {
  /** Active tasks to display in the dashboard */
  tasks: Task[];
  /** Callback when user clicks the review button */
  onReviewClick: () => void;
}

/**
 * AttentionCard Component
 * Displays when a workflow is waiting for human review
 */
const AttentionCard = ({
  task,
  onReviewClick,
}: {
  task: Task;
  onReviewClick: () => void;
}) => (
  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-6">
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="w-6 h-6 text-amber-600" />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Attention Required
        </h3>
        <p className="text-gray-600 text-sm mb-3">
          Workflow <span className="font-medium">{task.workflowName}</span> is waiting for your review.
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <Clock size={12} />
          <span>Started at {task.startTime}</span>
          <span className="mx-2">•</span>
          <Activity size={12} />
          <span>{task.progress}% complete</span>
        </div>
        <button
          onClick={onReviewClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Review Now
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  </div>
);

/**
 * QuickActionCard Component
 * Clickable card for quick actions
 */
const QuickActionCard = ({
  icon: Icon,
  title,
  description,
  onClick,
  color,
}: {
  icon: typeof Plus;
  title: string;
  description: string;
  onClick: () => void;
  color: 'blue' | 'green' | 'purple';
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    green: 'bg-green-50 text-green-600 hover:bg-green-100',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
  };

  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-left group"
    >
      <div
        className={clsx(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
          colorClasses[color]
        )}
      >
        <Icon size={20} />
      </div>
      <div>
        <h4 className="font-semibold text-gray-900 mb-0.5 group-hover:text-blue-600 transition-colors">
          {title}
        </h4>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </button>
  );
};

/**
 * StatusBadge Component
 * Displays task status with appropriate styling
 */
const StatusBadge = ({ status }: { status: TaskStatus }) => {
  const configs: Record<
    TaskStatus,
    { icon: typeof CheckCircle; text: string; className: string }
  > = {
    idle: {
      icon: Clock,
      text: 'Idle',
      className: 'bg-gray-100 text-gray-600',
    },
    running: {
      icon: Activity,
      text: 'Running',
      className: 'bg-blue-100 text-blue-600',
    },
    waiting_review: {
      icon: AlertTriangle,
      text: 'Review Needed',
      className: 'bg-amber-100 text-amber-600',
    },
    completed: {
      icon: CheckCircle,
      text: 'Completed',
      className: 'bg-green-100 text-green-600',
    },
    failed: {
      icon: AlertTriangle,
      text: 'Failed',
      className: 'bg-red-100 text-red-600',
    },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.className
      )}
    >
      <Icon size={12} />
      {config.text}
    </span>
  );
};

/**
 * Home Component
 * 
 * Main dashboard view showing overview of the AI workforce and active workflows.
 * Displays attention cards for tasks needing review and quick action shortcuts.
 * 
 * @example
 * ```tsx
 * <Home 
 *   tasks={tasks} 
 *   onReviewClick={() => setIsReviewModalOpen(true)} 
 * />
 * ```
 */
export const Home = ({ tasks, onReviewClick }: HomeProps) => {
  const activeTask = tasks.find(
    (t) => t.status === TaskStatus.Running || t.status === TaskStatus.WaitingForReview
  );

  const needsReview = activeTask?.status === TaskStatus.WaitingForReview;

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Good morning
        </h1>
        <p className="text-gray-500">
          Here's what's happening with your AI workforce today.
        </p>
      </div>

      {/* Attention Section */}
      {needsReview && activeTask && (
        <AttentionCard task={activeTask} onReviewClick={onReviewClick} />
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <QuickActionCard
          icon={Plus}
          title="New Workflow"
          description="Create an automated AI workflow"
          onClick={() => {}}
          color="blue"
        />
        <QuickActionCard
          icon={Users}
          title="Add Employee"
          description="Configure a new AI agent"
          onClick={() => {}}
          color="green"
        />
        <QuickActionCard
          icon={Zap}
          title="Run Task"
          description="Execute a workflow manually"
          onClick={() => {}}
          color="purple"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {tasks.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-3 text-gray-300" />
              <p>No recent activity</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {task.workflowName}
                    </h4>
                    <p className="text-sm text-gray-500">
                      Started {task.startTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {task.progress}%
                    </div>
                    <div className="text-xs text-gray-500">complete</div>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
