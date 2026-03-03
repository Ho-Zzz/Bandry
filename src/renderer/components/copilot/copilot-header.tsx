import { BrainIcon, SettingsIcon, Trash2Icon } from "lucide-react";

type CopilotHeaderProps = {
  memoryActive: boolean;
  canDeleteConversation: boolean;
  onDeleteConversation: () => void;
  onOpenSettings: () => void;
};

export const CopilotHeader = ({
  memoryActive,
  canDeleteConversation,
  onDeleteConversation,
  onOpenSettings
}: CopilotHeaderProps) => {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-900">Bandry Assistant</h1>
        <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">Routed by LeadAgent</span>
        {memoryActive ? (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
            <BrainIcon size={12} />
            Memory Active
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDeleteConversation}
          disabled={!canDeleteConversation}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2Icon size={13} />
          Delete
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          <SettingsIcon size={13} />
          Settings
        </button>
      </div>
    </header>
  );
};
