import { MessagePrimitive } from "@assistant-ui/react";

import { MessageTextPart } from "./message-parts";

export const SystemMessage = () => {
  return (
    <MessagePrimitive.Root className="my-4 flex justify-center">
      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
        <MessagePrimitive.Parts components={{ Text: MessageTextPart }} />
      </span>
    </MessagePrimitive.Root>
  );
};
