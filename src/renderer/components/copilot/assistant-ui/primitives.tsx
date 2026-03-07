import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { AttachmentPrimitive, useAuiState } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { XIcon } from "lucide-react";
import { clsx } from "clsx";

import "@assistant-ui/react-markdown/styles/dot.css";
import { usePreviewStore } from "../../../store/use-preview-store";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
};

export const IconButton = ({ tooltip, className, type = "button", children, ...rest }: PropsWithChildren<IconButtonProps>) => {
  return (
    <button
      type={type}
      title={tooltip}
      aria-label={tooltip}
      className={clsx(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
};

const FILE_PATH_REGEX = /(\/[\w./-]+\.\w+)/g;

const parseTextWithFilePaths = (text: string): Array<{ type: "text" | "file"; content: string }> => {
  const parts: Array<{ type: "text" | "file"; content: string }> = [];
  let lastIndex = 0;
  let match;

  const regex = new RegExp(FILE_PATH_REGEX);
  while ((match = regex.exec(text)) !== null) {
    // Add text before the file path
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    // Add the file path
    parts.push({ type: "file", content: match[0] });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", content: text }];
};

export const MarkdownText = () => {
  const text = useAuiState((s) => {
    const parts = s.message.parts;
    const textPart = parts.find((p) => typeof p === "object" && p !== null && "type" in p && p.type === "text");
    return textPart && typeof textPart === "object" && "text" in textPart ? String(textPart.text) : "";
  });

  const openPreview = usePreviewStore((s) => s.openPreview);
  const workspacePath = usePreviewStore((s) => s.workspacePath);

  // Check if text contains file paths (e.g., "已保存到文件：/mnt/workspace/output/report.md")
  const hasFilePaths = FILE_PATH_REGEX.test(text);

  if (hasFilePaths) {
    const parts = parseTextWithFilePaths(text);
    return (
      <div className="text-sm leading-7 text-zinc-900">
        {parts.map((part, index) => {
          if (part.type === "file") {
            const fileName = part.content.split("/").pop() || part.content;
            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  void openPreview(part.content, fileName, workspacePath);
                }}
                className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 hover:bg-emerald-100 hover:underline"
              >
                {part.content}
              </button>
            );
          }
          return <span key={index}>{part.content}</span>;
        })}
      </div>
    );
  }

  return (
    <MarkdownTextPrimitive
      smooth={false}
      className="text-sm leading-7 text-zinc-900 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-emerald-700 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-zinc-900 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-zinc-200 [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:text-zinc-900 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-900 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
    />
  );
};

export const ComposerAttachmentItem = () => {
  return (
    <AttachmentPrimitive.Root className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
      <AttachmentPrimitive.Name />
      <AttachmentPrimitive.Remove asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
          aria-label="Remove attachment"
        >
          <XIcon size={12} />
        </button>
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};

export const UserMessageAttachmentItem = () => {
  return (
    <AttachmentPrimitive.Root className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
      <AttachmentPrimitive.Name />
    </AttachmentPrimitive.Root>
  );
};
