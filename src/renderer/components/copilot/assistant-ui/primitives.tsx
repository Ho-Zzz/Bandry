import type { ButtonHTMLAttributes, MouseEvent, PropsWithChildren } from "react";
import { AttachmentPrimitive } from "@assistant-ui/react";
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
const FILE_PATH_DETECT_REGEX = /(\/[\w./-]+\.\w+)/;
const MARKDOWN_LINK_REGEX = /\[[^\]]+\]\([^)]+\)/;
const FILE_MARKDOWN_LINK_REGEX = /\[(\/[\w./-]+\.\w+)\]\((\/[\w./-]+\.\w+)\)/g;

const getFileName = (filePath: string): string => {
  const parts = filePath.split("/");
  const name = parts[parts.length - 1];
  return name || filePath;
};

const autoLinkFilePaths = (text: string): string => {
  if (!text.trim()) {
    return text;
  }

  // Some model outputs escape markdown link tokens (e.g. \[...\]\(...\)).
  // Normalize first so react-markdown can parse links.
  const normalizedEscapes = text
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")");

  const normalized = normalizedEscapes.replace(FILE_MARKDOWN_LINK_REGEX, (_match, _label, href) => {
    return `[${getFileName(href)}](${href})`;
  });

  if (MARKDOWN_LINK_REGEX.test(normalized)) {
    return normalized;
  }

  return normalized.replace(FILE_PATH_REGEX, (filePath) => `[${getFileName(filePath)}](${filePath})`);
};

export const MarkdownText = () => {
  const openPreview = usePreviewStore((s) => s.openPreview);
  const workspacePath = usePreviewStore((s) => s.workspacePath);
  const handleMarkdownClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute("href");
    if (!href) {
      return;
    }

    const decodedPath = decodeURIComponent(href);
    if (!FILE_PATH_DETECT_REGEX.test(decodedPath)) {
      return;
    }

    event.preventDefault();
    const fileName = decodedPath.split("/").pop() || decodedPath;
    void openPreview(decodedPath, fileName, workspacePath);
  };

  return (
    <div onClick={handleMarkdownClick}>
      <MarkdownTextPrimitive
        smooth={false}
        preprocess={autoLinkFilePaths}
        className="text-sm leading-7 text-zinc-900 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-emerald-700 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-zinc-900 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-zinc-200 [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:text-zinc-900 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-900 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
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
