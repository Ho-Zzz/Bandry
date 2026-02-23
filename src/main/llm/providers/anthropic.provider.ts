import type { IProvider, ProviderExecuteInput, ProviderExecutionContext } from "./base.provider";
import type { StreamEvent } from "../runtime/schema";

export class AnthropicProvider implements IProvider {
  readonly id = "anthropic";

  async *execute(
    input: ProviderExecuteInput,
    context: ProviderExecutionContext
  ): AsyncIterable<StreamEvent> {
    void input;
    void context;

    yield {
      type: "error",
      error: "Anthropic provider is not implemented yet"
    };
  }
}

export const anthropicProvider = new AnthropicProvider();
