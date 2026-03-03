import type { PendingClarification } from "../../features/copilot/use-copilot-chat";

type ClarificationPanelProps = {
  pendingClarification: PendingClarification | null;
  clarificationInput: string;
  isLoading: boolean;
  onClarificationInputChange: (value: string) => void;
  onClarificationOptionSelect: (value: string) => void;
  onClarificationCustomSubmit: () => void;
};

export const ClarificationPanel = ({
  pendingClarification,
  clarificationInput,
  isLoading,
  onClarificationInputChange,
  onClarificationOptionSelect,
  onClarificationCustomSubmit
}: ClarificationPanelProps) => {
  if (!pendingClarification) {
    return null;
  }

  return (
    <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
      <p className="text-sm font-medium text-amber-900">需要澄清后继续</p>
      <p className="mt-1 text-sm text-amber-800">{pendingClarification.question}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {pendingClarification.options.slice(0, 3).map((option, index) => (
          <button
            key={`${option.label}-${index}`}
            type="button"
            className={
              option.recommended
                ? "rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800"
                : "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
            }
            onClick={() => {
              onClarificationOptionSelect(option.value);
            }}
            disabled={isLoading}
          >
            {option.label}
            {option.recommended ? "（推荐）" : ""}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={clarificationInput}
          onChange={(event) => onClarificationInputChange(event.target.value)}
          placeholder="输入自定义回答"
          className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={onClarificationCustomSubmit}
          disabled={isLoading || clarificationInput.trim().length === 0}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          发送
        </button>
      </div>
    </div>
  );
};
