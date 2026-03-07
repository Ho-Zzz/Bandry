import { useEffect, useState } from "react";
import { Coins, MessageSquare, TrendingUp } from "lucide-react";
import type { GlobalTokenStatsResult } from "../../../shared/ipc";

export const TokenDashboard = () => {
  const [stats, setStats] = useState<GlobalTokenStatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const result = await window.api.conversationGetGlobalTokenStats();
        setStats(result);
      } catch (error) {
        console.error("Failed to load token stats:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadStats();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Token Usage</h2>
        </div>
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!stats || stats.totalTokens === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Token Usage</h2>
        </div>
        <div className="text-sm text-gray-500">No token usage data yet. Start a conversation to see statistics.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-6">
        <Coins className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold text-gray-900">Token Usage</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">Total Tokens</span>
          </div>
          <div className="text-2xl font-bold text-emerald-900">{stats.totalTokens.toLocaleString()}</div>
        </div>

        <div className="rounded-lg bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Conversations</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{stats.conversationCount}</div>
        </div>

        <div className="rounded-lg bg-purple-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Messages</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">{stats.messageCount}</div>
        </div>
      </div>

      {/* Token Breakdown */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Token Breakdown</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Prompt Tokens</span>
            <span className="font-medium text-gray-900">{stats.promptTokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Completion Tokens</span>
            <span className="font-medium text-gray-900">{stats.completionTokens.toLocaleString()}</span>
          </div>
          <div className="h-px bg-gray-200 my-2" />
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">{stats.totalTokens.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Top Conversations */}
      {stats.topConversations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Top Conversations by Token Usage</h3>
          <div className="space-y-2">
            {stats.topConversations.map((conv, index) => (
              <div
                key={conv.conversationId}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-medium text-gray-400">#{index + 1}</span>
                  <span className="text-gray-700 truncate">
                    {conv.title || `Conversation ${conv.conversationId.slice(0, 8)}`}
                  </span>
                </div>
                <span className="font-medium text-gray-900 ml-2 shrink-0">
                  {conv.totalTokens.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
