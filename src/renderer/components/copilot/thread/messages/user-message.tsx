import { MessagePrimitive } from "@assistant-ui/react";

import { UserMessageAttachmentItem } from "../../assistant-ui/primitives";
import { BranchPicker, UserActionBar } from "./message-action-bars";
import { MessageTextPart } from "./message-parts";

export const UserMessage = () => {
  return (
    <MessagePrimitive.Root
      className="mx-auto grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 fade-in slide-in-from-bottom-1 animate-in duration-150"
      data-role="user"
    >
      <MessagePrimitive.Attachments
        components={{
          Attachment: UserMessageAttachmentItem
        }}
      />

      <div className="relative col-start-2 min-w-0">
        <div className="rounded-3xl bg-zinc-100 px-4 py-2.5 break-words text-zinc-900">
          <MessagePrimitive.Parts components={{ Text: MessageTextPart }} />
        </div>
        <div className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
};
