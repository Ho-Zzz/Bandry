import { ComposerPrimitive, MessagePrimitive } from "@assistant-ui/react";

export const EditComposer = () => {
  return (
    <MessagePrimitive.Root className="mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col px-2 py-3">
      <ComposerPrimitive.Root className="ml-auto flex w-full max-w-[85%] flex-col rounded-3xl bg-zinc-100">
        <ComposerPrimitive.Input className="min-h-14 w-full resize-none bg-transparent p-4 text-sm text-zinc-900 outline-none" autoFocus />
        <div className="mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <button
              type="button"
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200"
            >
              Cancel
            </button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Update
            </button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};
