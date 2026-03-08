import { useState } from "react";
import { ChevronDown, ChevronRight, Coins } from "lucide-react";

type TokenBadgeProps = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export const TokenBadge = ({ promptTokens, completionTokens, totalTokens }: TokenBadgeProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no token data
  if (!totalTokens && !promptTokens && !completionTokens) {
    return null;
  }

  const displayTotal = totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0);

  return (
    <div className="mt-2 inline-flex flex-col gap-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 transition-colors"
        type="button"
      >
        <Coins className="h-3 w-3" />
        <span className="font-medium">{displayTotal.toLocaleString()} tokens</span>
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {isExpanded && (
        <div className="ml-1 flex flex-col gap-0.5 text-xs text-gray-500">
          {promptTokens !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">•</span>
              <span>Prompt: {promptTokens.toLocaleString()}</span>
            </div>
          )}
          {completionTokens !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">•</span>
              <span>Completion: {completionTokens.toLocaleString()}</span>
            </div>
          )}
          {totalTokens !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">•</span>
              <span>Total: {totalTokens.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
