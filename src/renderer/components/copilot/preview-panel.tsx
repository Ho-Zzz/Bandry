/**
 * Preview Panel Component
 *
 * Right-side panel that renders file content preview.
 * Supports Markdown rendering for .md files and code block display for other text files.
 */

import { useEffect } from "react";
import { X, FileText, Loader2, AlertCircle } from "lucide-react";
import Markdown from "react-markdown";
import { usePreviewStore } from "../../store/use-preview-store";

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx", ".markdown"]);

const getFileExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return fileName.slice(dotIndex).toLowerCase();
};

const isMarkdownFile = (fileName: string): boolean => {
  return MARKDOWN_EXTENSIONS.has(getFileExtension(fileName));
};

const isBinaryContent = (content: string): boolean => {
  const sample = content.slice(0, 512);
  // eslint-disable-next-line no-control-regex
  return /[\x00-\x08\x0E-\x1F]/.test(sample);
};

const MarkdownPreview = ({ content }: { content: string }) => {
  return (
    <div className="prose prose-sm max-w-none text-sm leading-7 text-zinc-900 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-blue-600 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-zinc-900 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-zinc-200 [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:text-zinc-900 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-900 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-2 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_td]:border [&_td]:border-zinc-200 [&_td]:px-3 [&_td]:py-1.5 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-600">
      <Markdown>{content}</Markdown>
    </div>
  );
};

const CodePreview = ({ content, fileName }: { content: string; fileName: string }) => {
  return (
    <div>
      <div className="mb-2 text-xs text-zinc-500">{fileName}</div>
      <pre className="max-w-full overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-[13px] leading-6 text-zinc-800">
        <code>{content}</code>
      </pre>
    </div>
  );
};

export const PreviewPanel = () => {
  const { isOpen, fileName, content, loading, error, closePreview } = usePreviewStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closePreview();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePreview]);

  if (!isOpen) {
    return null;
  }

  const isMarkdown = fileName ? isMarkdownFile(fileName) : false;
  const isBinary = content ? isBinaryContent(content) : false;

  return (
    <div className="flex h-full w-[480px] shrink-0 flex-col border-l border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText size={16} className="shrink-0 text-zinc-500" />
          <span className="truncate text-sm font-medium text-zinc-800">{fileName}</span>
          {isMarkdown && (
            <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              Markdown
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={closePreview}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          title="Close preview"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-zinc-400" />
            <span className="ml-2 text-sm text-zinc-500">Loading file...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span className="text-sm text-rose-700">{error}</span>
          </div>
        )}

        {content !== null && !loading && !error && (
          <>
            {isBinary ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText size={32} className="text-zinc-300" />
                <p className="mt-2 text-sm text-zinc-500">Binary file — preview not available</p>
              </div>
            ) : isMarkdown ? (
              <MarkdownPreview content={content} />
            ) : (
              <CodePreview content={content} fileName={fileName ?? ""} />
            )}
          </>
        )}
      </div>
    </div>
  );
};
