import type { PropsWithChildren } from "react";
import type { TextMessagePartProps, ToolCallMessagePartProps } from "@assistant-ui/react";

import { MarkdownText } from "../../assistant-ui/primitives";

export const MessageTextPart = ({ text }: TextMessagePartProps) => {
  return <div className="whitespace-pre-wrap break-words">{text}</div>;
};

export const AssistantTextPart = () => {
  return <MarkdownText />;
};

export const HiddenTracePart = (part: ToolCallMessagePartProps) => {
  void part;
  return null;
};

export const HiddenTraceGroup = (group: PropsWithChildren<{ startIndex: number; endIndex: number }>) => {
  void group;
  return null;
};
