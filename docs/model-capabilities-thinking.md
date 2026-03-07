# 模型能力配置与 Thinking 降级说明

本文说明 Bandry 在“请求级 Agent + 能力驱动 Thinking”架构下的配置方式与降级行为。

## 1. 配置字段

模型档案（`modelProfiles[]`）新增两个可选字段：

- `capabilities`
  - `supportsThinking?: boolean`
  - `supportsReasoningEffort?: boolean`
  - `supportsVision?: boolean`
  - `supportsToolCall?: boolean`
- `whenThinkingEnabled`
  - `extraBody?: Record<string, unknown>`
  - `reasoningEffort?: "minimal" | "low" | "medium" | "high"`

这些字段会被：

1. 配置读取/合并层保留
2. `getConfigSummary().modelProfiles` 返回给前端
3. 设置页保存时原样保留

## 2. 配置示例

```json
{
  "modelProfiles": [
    {
      "id": "deepseek-r1",
      "name": "DeepSeek R1",
      "provider": "deepseek",
      "model": "deepseek-reasoner",
      "enabled": true,
      "temperature": 0.7,
      "maxTokens": 8000,
      "capabilities": {
        "supportsThinking": true,
        "supportsReasoningEffort": true,
        "supportsToolCall": true
      },
      "whenThinkingEnabled": {
        "extraBody": {
          "reasoningEffort": "high",
          "serviceTier": "auto"
        },
        "reasoningEffort": "high"
      }
    },
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "provider": "openai",
      "model": "gpt-4o",
      "enabled": true,
      "capabilities": {
        "supportsThinking": false,
        "supportsVision": true,
        "supportsToolCall": true
      }
    }
  ]
}
```

## 3. Thinking 生效规则

后端每次请求都会通过 `ChatAgentFactory` 计算 `effectiveThinkingEnabled`：

1. `mode == "thinking"`：强制 `true`
2. 否则使用请求显式值 `thinkingEnabled`
3. 请求未显式指定时：默认取 `Boolean(capabilities.supportsThinking)`

前端规则：

- Thinking 开关始终显示
- `supportsThinking=true` 时默认开
- `supportsThinking=false` 时默认关，但允许手动打开

## 4. reasoningEffort 优先级

最终生效优先级（高 -> 低）：

1. 请求参数 `reasoningEffort`
2. `whenThinkingEnabled.reasoningEffort`
3. 当模型声明支持 thinking 且本次 thinking 关闭时，自动降为 `minimal`

## 5. extraBody 透传与白名单策略

当前 OpenAI-compatible 路径采用“白名单映射 + 降级”，不承诺任意 `extraBody` 无损透传。

已支持的典型键（示例）：

- `reasoningEffort`
- `serviceTier`
- `metadata`
- `prediction`
- `maxCompletionTokens`
- `user`
- `parallelToolCalls`

行为：

- 白名单内键：映射到 `providerOptions.openai.*`
- 未知键：丢弃，不中断请求
- `reasoning_effort` 会规范化为 `reasoningEffort`

## 6. 降级行为说明

出现能力或 provider 限制时，系统采用“不中断对话”的降级策略：

1. 模型未声明 `supportsThinking`，但用户打开 thinking
   - 继续执行（best-effort）
   - 通过 chat update 输出 warning
2. 请求传入 `reasoningEffort`，但 `supportsReasoningEffort=false`
   - 忽略该参数
   - 输出 warning
3. `whenThinkingEnabled.extraBody` 包含不支持字段
   - 丢弃不支持字段
   - 输出 warning
4. 请求 profile 不存在或被禁用
   - 回退到 runtime routing
   - 输出 warning

这些 warning 会以 `chat:update` 的 `planning` 阶段消息形式发给前端（例如 `Thinking fallback: ...`）。

## 7. Channels 侧说明

在 Feishu/Lark 渠道消息中：

- `/think` 会映射为 `mode=thinking` 且 `thinkingEnabled=true`
- 每条入站消息都使用请求级新建 agent，不复用单例

## 8. 连接模型时的能力自动写入

`models:connect` 会根据 catalog 自动映射能力：

- `reasoning -> supportsThinking/supportsReasoningEffort`
- `toolCall -> supportsToolCall`
- `inputModalities` 含 `image` -> `supportsVision`

`whenThinkingEnabled` 不自动填模板，建议按 provider 手工配置。
