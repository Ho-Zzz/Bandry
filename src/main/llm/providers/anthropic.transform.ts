import type { TextStreamPart, ToolSet } from "ai";
import type { StreamEvent } from "../runtime/schema";
import type { ITransform, ProviderRequest, ProviderTransformInput } from "../runtime/transform";
import { openAiCompatibleTransform } from "../runtime/transform";

const mapMessagesForAnthropic = (input: ProviderTransformInput): ProviderRequest => {
  const base = openAiCompatibleTransform.request(input);

  return {
    ...base,
    providerOptions: undefined
  };
};

export const anthropicTransform: ITransform = {
  request(input: ProviderTransformInput): ProviderRequest {
    return mapMessagesForAnthropic(input);
  },
  response(part: TextStreamPart<ToolSet>): StreamEvent[] {
    return openAiCompatibleTransform.response(part);
  }
};
