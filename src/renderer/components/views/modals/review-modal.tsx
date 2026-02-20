/**
 * Review Modal Component
 * 
 * Modal dialog for human-in-the-loop workflow approvals.
 * Displays pending review content with approve/reject actions and feedback options.
 */

import { useState } from 'react';
import {
  X,
  Check,
  Edit3,
  MessageSquare,
  AlertTriangle,
  FileText,
  Clock,
  User,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Task } from '../../../types/app';

interface ReviewModalProps {
  /** Task containing the pending review data */
  task: Task;
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when user approves the content */
  onApprove: () => void;
}

/**
 * ReviewModal Component
 * 
 * Displays workflow content awaiting human approval with options to:
 * - Approve and continue workflow
 * - Reject with feedback
 * - Edit content directly
 * 
 * @example
 * ```tsx
 * <ReviewModal
 *   task={activeTask}
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   onApprove={handleApprove}
 * />
 * ```
 */
export const ReviewModal = ({
  task,
  isOpen,
  onClose,
  onApprove,
}: ReviewModalProps) => {
  const [feedback, setFeedback] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen) return null;

  const reviewData = task.pendingReviewData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Review Required
              </h2>
              <p className="text-sm text-gray-500">
                {task.workflowName} • Step {Math.round(task.progress / 100 * 4)}/4
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Review Info Card */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <FileText size={14} />
                <span>Format: {reviewData?.format || 'Text'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                <span>Started: {task.startTime}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User size={14} />
                <span>Progress: {task.progress}%</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            {reviewData?.title || 'Pending Review'}
          </h3>

          {/* Content Preview */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Content Preview</span>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={clsx(
                  'flex items-center gap-1.5 text-sm px-2 py-1 rounded transition-colors',
                  isEditing
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                )}
              >
                <Edit3 size={14} />
                {isEditing ? 'Done Editing' : 'Edit'}
              </button>
            </div>
            <div className="p-4">
              {isEditing ? (
                <textarea
                  className="w-full min-h-[200px] p-3 border border-gray-200 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  defaultValue={reviewData?.content || ''}
                />
              ) : (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-700 bg-gray-50 p-4 rounded-lg overflow-auto">
                    {reviewData?.content || 'No content to review.'}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Input */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MessageSquare size={14} />
              Feedback (Optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Add any feedback or requested changes..."
              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              rows={3}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">
              Request Changes
            </button>
            <button
              onClick={onApprove}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Check size={16} />
              Approve & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
