import type { ComponentPropsWithoutRef } from "react";
import {
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ErrorPrimitive,
  MessagePrimitive
} from "@assistant-ui/react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  RefreshCwIcon
} from "lucide-react";
import { clsx } from "clsx";

import { IconButton } from "../../assistant-ui/primitives";

export const UserActionBar = () => {
  return (
    <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="flex flex-col items-end">
      <ActionBarPrimitive.Edit asChild>
        <IconButton tooltip="Edit message" className="h-7 w-7">
          <PencilIcon size={14} />
        </IconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

export const AssistantActionBar = () => {
  return (
    <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="-ml-1 flex gap-1 text-zinc-500">
      <ActionBarPrimitive.Copy asChild>
        <IconButton tooltip="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon size={14} />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon size={14} />
          </AuiIf>
        </IconButton>
      </ActionBarPrimitive.Copy>

      <ActionBarPrimitive.ExportMarkdown asChild>
        <IconButton tooltip="Export markdown">
          <DownloadIcon size={14} />
        </IconButton>
      </ActionBarPrimitive.ExportMarkdown>

      <ActionBarPrimitive.Reload asChild>
        <IconButton tooltip="Retry">
          <RefreshCwIcon size={14} />
        </IconButton>
      </ActionBarPrimitive.Reload>

    </ActionBarPrimitive.Root>
  );
};

type BranchPickerProps = ComponentPropsWithoutRef<typeof BranchPickerPrimitive.Root>;

export const BranchPicker = ({ className, ...rest }: BranchPickerProps) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={clsx("mr-2 -ml-2 inline-flex items-center text-xs text-zinc-500", className)}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <IconButton tooltip="Previous branch">
          <ChevronLeftIcon size={14} />
        </IconButton>
      </BranchPickerPrimitive.Previous>

      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>

      <BranchPickerPrimitive.Next asChild>
        <IconButton tooltip="Next branch">
          <ChevronRightIcon size={14} />
        </IconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

export const MessageError = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        <ErrorPrimitive.Message className="line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};
