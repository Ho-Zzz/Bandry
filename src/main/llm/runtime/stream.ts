import type { AsyncIterableStream, TextStreamPart, ToolSet } from "ai";
import type { StreamEvent } from "./schema";
import type { ITransform } from "./transform";

export async function* toStreamEvents(
  stream: AsyncIterableStream<TextStreamPart<ToolSet>>,
  transform: ITransform
): AsyncIterable<StreamEvent> {
  for await (const part of stream) {
    const events = transform.response(part);
    for (const event of events) {
      yield event;
    }
  }
}
