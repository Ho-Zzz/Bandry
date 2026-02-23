import { z } from "zod";

export const ModelMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  tool_call_id: z.string().optional()
});

export const ModelRequestSchema = z.object({
  modelId: z.string().min(1),
  messages: z.array(ModelMessageSchema).min(1),
  tools: z.array(z.unknown()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().positive().optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  stop: z.array(z.string()).optional()
});

export const ProviderRuntimeConfigSchema = z.object({
  provider: z.string().min(1),
  baseUrl: z.string().min(1),
  apiKey: z.string(),
  orgId: z.string().optional()
});

export const StreamUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional()
});

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("content_delta"),
    delta: z.string()
  }),
  z.object({
    type: z.literal("tool_call_delta"),
    toolCallId: z.string(),
    toolName: z.string().optional(),
    delta: z.string()
  }),
  z.object({
    type: z.literal("tool_call"),
    toolCall: z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.unknown()
    })
  }),
  z.object({
    type: z.literal("finish"),
    reason: z.string(),
    usage: StreamUsageSchema.optional()
  }),
  z.object({
    type: z.literal("error"),
    error: z.string()
  })
]);

export type ModelMessage = z.infer<typeof ModelMessageSchema>;
export type ModelRequest = z.infer<typeof ModelRequestSchema>;
export type ProviderRuntimeConfig = z.infer<typeof ProviderRuntimeConfigSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type StreamUsage = z.infer<typeof StreamUsageSchema>;
