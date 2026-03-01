import { Blocks } from "lucide-react";
import { SkillsManager } from "../persona/skills-manager";

export const Skills = () => (
  <div className="flex flex-col h-full w-full bg-gray-50">
    <div className="border-b border-gray-200 px-6 py-4 bg-white">
      <div className="flex items-center gap-3">
        <Blocks size={24} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Skills</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1">Manage global skill modules</p>
    </div>
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
      <SkillsManager />
    </div>
  </div>
);
