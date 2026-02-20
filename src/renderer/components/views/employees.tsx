/**
 * Employees View Component
 * 
 * Displays a grid of AI employee/agent cards with their roles,
 * descriptions, models, and available tools.
 */

import { Bot, Sparkles, Command, Cpu, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { MOCK_EMPLOYEES } from '../../data/mock';
import type { Employee, EmployeeRole } from '../../types/app';

/**
 * RoleIcon Component
 * Displays appropriate icon based on employee role
 */
const RoleIcon = ({ role }: { role: EmployeeRole }) => {
  const icons: Record<EmployeeRole, typeof Bot> = {
    Researcher: Command,
    Writer: Sparkles,
    Planner: Bot,
    Analyst: Cpu,
  };

  const colors: Record<EmployeeRole, string> = {
    Researcher: 'text-blue-500 bg-blue-50',
    Writer: 'text-purple-500 bg-purple-50',
    Planner: 'text-green-500 bg-green-50',
    Analyst: 'text-orange-500 bg-orange-50',
  };

  const Icon = icons[role];

  return (
    <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', colors[role])}>
      <Icon size={20} />
    </div>
  );
};

/**
 * StatusIndicator Component
 * Shows online/busy/offline status with colored dot
 */
const StatusIndicator = ({
  status,
  showLabel = false,
}: {
  status: Employee['status'];
  showLabel?: boolean;
}) => {
  const config = {
    online: { color: 'bg-green-500', label: 'Online' },
    busy: { color: 'bg-red-500', label: 'Busy' },
    offline: { color: 'bg-gray-400', label: 'Offline' },
  };

  const { color, label } = config[status];

  return (
    <div className="flex items-center gap-1.5">
      <div className={clsx('w-2 h-2 rounded-full', color)} />
      {showLabel && (
        <span className="text-xs text-gray-500">{label}</span>
      )}
    </div>
  );
};

/**
 * EmployeeCard Component
 * Individual employee card displaying all relevant information
 */
const EmployeeCard = ({ employee }: { employee: Employee }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group">
    {/* Header with Avatar and Status */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <img
          src={employee.avatar}
          alt={employee.name}
          className="w-12 h-12 rounded-full object-cover border-2 border-gray-100 group-hover:border-blue-100 transition-colors"
        />
        <div>
          <h3 className="font-semibold text-gray-900">{employee.name}</h3>
          <StatusIndicator status={employee.status} showLabel />
        </div>
      </div>
      <RoleIcon role={employee.role} />
    </div>

    {/* Description */}
    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
      {employee.description}
    </p>

    {/* Model Info */}
    <div className="mb-3">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
        Model
      </div>
      <div className="text-sm text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">
        {employee.model}
      </div>
    </div>

    {/* Tools */}
    <div>
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
        Tools
      </div>
      <div className="flex flex-wrap gap-1.5">
        {employee.tools.map((tool) => (
          <span
            key={tool}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
          >
            {tool}
          </span>
        ))}
      </div>
    </div>
  </div>
);

/**
 * AddEmployeeCard Component
 * Placeholder card for adding new employees
 */
const AddEmployeeCard = () => (
  <button className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50/50 transition-all min-h-[280px]">
    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
      <Plus size={24} />
    </div>
    <span className="font-medium">Add New Employee</span>
    <span className="text-sm mt-1">Configure a new AI agent</span>
  </button>
);

/**
 * Employees Component
 * 
 * Displays the AI employee directory in a grid layout.
 * Shows all configured AI agents with their capabilities.
 * 
 * @example
 * ```tsx
 * <Employees />
 * ```
 */
export const Employees = () => {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">People</h1>
          <p className="text-gray-500">
            Manage your AI workforce and their capabilities
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          Add Employee
        </button>
      </div>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_EMPLOYEES.map((employee) => (
          <EmployeeCard key={employee.id} employee={employee} />
        ))}
        <AddEmployeeCard />
      </div>

      {/* Stats Summary */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-900">
            {MOCK_EMPLOYEES.length}
          </div>
          <div className="text-sm text-gray-500">Total Employees</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-600">
            {MOCK_EMPLOYEES.filter((e) => e.status === 'online').length}
          </div>
          <div className="text-sm text-gray-500">Online</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-600">
            {MOCK_EMPLOYEES.filter((e) => e.status === 'busy').length}
          </div>
          <div className="text-sm text-gray-500">Busy</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-600">
            {MOCK_EMPLOYEES.filter((e) => e.status === 'offline').length}
          </div>
          <div className="text-sm text-gray-500">Offline</div>
        </div>
      </div>
    </div>
  );
};
