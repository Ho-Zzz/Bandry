import type { IProvider } from "./base.provider";
import { anthropicProvider } from "./anthropic.provider";
import { deepseekProvider } from "./deepseek.provider";
import { groqProvider } from "./groq.provider";
import { moonshotProvider } from "./moonshot.provider";
import { openaiProvider } from "./openai.provider";
import { openrouterProvider } from "./openrouter.provider";
import { qwenProvider } from "./qwen.provider";
import { siliconflowProvider } from "./siliconflow.provider";
import { togetherProvider } from "./together.provider";
import { minimaxProvider } from "./minimax.provider";
import { volcengineProvider } from "./volcengine.provider";

export const providerRegistry = new Map<string, IProvider>();

[openaiProvider, deepseekProvider, volcengineProvider, openrouterProvider, groqProvider, moonshotProvider, qwenProvider, siliconflowProvider, togetherProvider, minimaxProvider, anthropicProvider].forEach((provider) => {
  providerRegistry.set(provider.id, provider);
});
