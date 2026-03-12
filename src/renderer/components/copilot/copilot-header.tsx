import { useEffect, useRef, useState } from "react";
import { BrainIcon, MoreHorizontalIcon, SettingsIcon, Trash2Icon } from "lucide-react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
      <div className="flex items-center gap-3">
        {memoryActive ? (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
            <BrainIcon size={12} />
            Memory Active
          </span>
        ) : null}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((previous) => !previous)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Open menu"
          title="Menu"
        >
          <MoreHorizontalIcon size={14} />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-zinc-200 bg-white p-1 shadow-md" role="menu">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenSettings();
              }}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-50"
              role="menuitem"
            >
              <SettingsIcon size={13} />
              Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDeleteConversation();
              }}
              disabled={!canDeleteConversation}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
              role="menuitem"
            >
              <Trash2Icon size={13} />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
