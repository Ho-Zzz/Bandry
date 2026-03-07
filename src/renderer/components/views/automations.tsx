import { Clock } from "lucide-react";
import { AutomationManager } from "../automation/automation-manager";

export const Automations = () => (
  <div className="flex flex-col h-full w-full bg-gray-50">
    <div className="border-b border-gray-200 px-6 py-4 bg-white">
      <div className="flex items-center gap-3">
        <Clock size={24} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">自动化任务</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1">使用 Cron 表达式定时调度 AI 智能体任务</p>
    </div>
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <AutomationManager />
      </div>
    </div>
  </div>
);
