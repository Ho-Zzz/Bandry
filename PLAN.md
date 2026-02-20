# 实现计划：LeadAgent 动态模型切换功能

## 当前架构分析

### 后端（Main Process）
- **配置系统**：分层配置（默认 → 项目 → 用户 → 环境变量）
- **模型工厂**：`ModelsFactory` 支持 OpenAI、DeepSeek、Volcengine 三个 provider
- **Chat Agent**：`DeepSeekToolChatAgent` 硬编码使用 DeepSeek provider
- **配置加载**：启动时一次性加载，不支持运行时更新

### 前端（Renderer Process）
- **Settings Store**：已有 `useSettingsStore`，包含 LLM 配置（provider、apiKey、baseUrl、modelName）
- **Session Store**：会话管理，每个会话关联一个 agentId
- **IPC 通信**：通过 `chat:send` 发送消息，但不传递模型配置

### 核心问题
1. Chat Agent 硬编码使用 DeepSeek，无法动态切换
2. 前端 Settings Store 的配置未与后端同步
3. 缺少用户级别的 API Key 管理界面
4. 配置更新后需要重启应用才能生效

---

## 实现方案

### 方案 A：会话级模型配置（推荐）
每个会话可以独立选择模型，类似 Cursor 的体验。

**优点**：
- 灵活性高，不同会话可用不同模型
- 符合用户习惯（Cursor、ChatGPT 等）
- 易于 A/B 测试不同模型

**缺点**：
- 实现复杂度稍高
- 需要在会话中存储模型配置

### 方案 B：全局模型配置
所有会话共享一个模型配置，通过设置页面切换。

**优点**：
- 实现简单
- 配置管理集中

**缺点**：
- 灵活性低
- 切换模型会影响所有会话

**推荐方案 A**，因为它提供更好的用户体验。

---

## 详细设计（方案 A）

### 1. 数据模型扩展

#### 1.1 前端 Session Store
```typescript
// src/renderer/store/use-session-store.ts
export interface ChatSession {
  id: string;
  title: string;
  agentId: string;
  lastMessage?: string;
  updatedAt: number;
  unreadCount: number;
  pinned: boolean;
  // 新增：会话级模型配置
  modelConfig?: {
    provider: 'openai' | 'deepseek' | 'volcengine' | 'anthropic';
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };
}
```

#### 1.2 IPC 类型扩展
```typescript
// src/shared/ipc.ts
export type ChatSendInput = {
  requestId?: string;
  message: string;
  history: ChatHistoryMessage[];
  // 新增：可选的模型配置覆盖
  modelConfig?: {
    provider: ModelProvider;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };
};
```

#### 1.3 后端配置类型扩展
```typescript
// src/main/config/types.ts
export type RuntimeProviderConfig = {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  orgId?: string;
};
```

### 2. 后端实现

#### 2.1 通用 Chat Agent
创建 `UniversalChatAgent` 替代硬编码的 `DeepSeekToolChatAgent`：

```typescript
// src/main/chat/universal-chat-agent.ts
export class UniversalChatAgent {
  constructor(
    private readonly config: AppConfig,
    private readonly modelsFactory: ModelsFactory,
    private readonly sandboxService: SandboxService
  ) {}

  async send(
    input: ChatSendInput,
    onUpdate?: (stage: ChatUpdateStage, message: string) => void
  ): Promise<ChatSendResult> {
    // 1. 解析模型配置（优先使用 input.modelConfig，否则使用默认配置）
    const providerConfig = this.resolveProviderConfig(input.modelConfig);

    // 2. 验证 provider 是否配置
    if (!this.isProviderConfigured(providerConfig)) {
      throw new Error(`Provider ${providerConfig.provider} is not configured`);
    }

    // 3. 执行 planner 循环（与 DeepSeekToolChatAgent 类似）
    // 4. 使用 providerConfig 调用模型
  }

  private resolveProviderConfig(override?: ChatSendInput['modelConfig']): RuntimeProviderConfig {
    if (override) {
      return {
        provider: override.provider,
        apiKey: override.apiKey || this.config.providers[override.provider].apiKey,
        baseUrl: override.baseUrl || this.config.providers[override.provider].baseUrl,
        model: override.model || this.config.providers[override.provider].model,
      };
    }

    const defaultProvider = this.config.llm.defaultProvider;
    return {
      provider: defaultProvider,
      ...this.config.providers[defaultProvider],
    };
  }
}
```

#### 2.2 ModelsFactory 增强
支持运行时传入 provider 配置：

```typescript
// src/main/models/models-factory.ts
async generateText(input: GenerateTextInput & {
  runtimeConfig?: RuntimeProviderConfig;
}): Promise<GenerateTextResult> {
  const resolved = input.runtimeConfig
    ? input.runtimeConfig
    : this.resolveProviderConfig(input);
  // ... 现有逻辑
}
```

#### 2.3 IPC Handler 更新
```typescript
// src/main/index.ts
ipcMain.handle("chat:send", async (_event, input: ChatSendInput): Promise<ChatSendResult> => {
  const requestId = input.requestId?.trim() || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return await universalChatAgent.send(input, (stage, message) => {
    broadcastChatUpdate({ requestId, stage, message, timestamp: Date.now() });
  });
});
```

### 3. 前端实现

#### 3.1 模型配置管理 Store
```typescript
// src/renderer/store/use-model-config-store.ts
interface ModelConfigState {
  // 用户保存的模型配置列表
  savedConfigs: Array<{
    id: string;
    name: string; // 用户自定义名称，如 "GPT-4 Turbo"
    provider: 'openai' | 'deepseek' | 'volcengine' | 'anthropic';
    model: string;
    apiKey: string;
    baseUrl: string;
    isDefault?: boolean;
  }>;

  // Actions
  addConfig: (config: Omit<SavedModelConfig, 'id'>) => void;
  updateConfig: (id: string, updates: Partial<SavedModelConfig>) => void;
  deleteConfig: (id: string) => void;
  setDefaultConfig: (id: string) => void;
}
```

#### 3.2 模型选择器组件
```typescript
// src/renderer/components/model-selector.tsx
export const ModelSelector = ({
  value: string | undefined,
  onChange: (configId: string) => void
}) => {
  const configs = useModelConfigStore(state => state.savedConfigs);

  return (
    <Select value={value} onChange={onChange}>
      {configs.map(config => (
        <SelectItem key={config.id} value={config.id}>
          {config.name} ({config.provider}/{config.model})
        </SelectItem>
      ))}
      <SelectItem value="add-new">+ Add New Model</SelectItem>
    </Select>
  );
};
```

#### 3.3 模型配置表单
```typescript
// src/renderer/components/model-config-form.tsx
export const ModelConfigForm = ({
  onSave: (config: ModelConfig) => void
}) => {
  return (
    <form>
      <Input label="Configuration Name" placeholder="GPT-4 Turbo" />
      <Select label="Provider">
        <option value="openai">OpenAI</option>
        <option value="deepseek">DeepSeek</option>
        <option value="volcengine">Volcengine</option>
        <option value="anthropic">Anthropic</option>
      </Select>
      <Input label="Model Name" placeholder="gpt-4-turbo" />
      <Input label="API Key" type="password" />
      <Input label="Base URL" placeholder="https://api.openai.com/v1" />
      <Button type="submit">Save</Button>
    </form>
  );
};
```

#### 3.4 Chat Interface 集成
```typescript
// src/renderer/features/chat/components/chat-interface.tsx
export const ChatInterface = () => {
  const session = useSessionStore(state => state.sessions.find(s => s.id === sessionId));
  const updateSession = useSessionStore(state => state.updateSession);
  const modelConfigs = useModelConfigStore(state => state.savedConfigs);

  const handleModelChange = (configId: string) => {
    const config = modelConfigs.find(c => c.id === configId);
    if (config) {
      updateSession(session.id, {
        modelConfig: {
          provider: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
        }
      });
    }
  };

  const handleSendMessage = async (message: string) => {
    const result = await window.api.chatSend({
      message,
      history: session.history,
      modelConfig: session.modelConfig, // 传递会话的模型配置
    });
  };

  return (
    <div>
      <ModelSelector
        value={session.modelConfigId}
        onChange={handleModelChange}
      />
      {/* ... 消息列表和输入框 */}
    </div>
  );
};
```

### 4. 设置页面

#### 4.1 模型管理页面
```typescript
// src/renderer/components/views/settings/models.tsx
export const ModelsSettings = () => {
  const configs = useModelConfigStore(state => state.savedConfigs);
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div>
      <h2>Model Configurations</h2>
      <Button onClick={() => setIsFormOpen(true)}>Add New Model</Button>

      <div className="configs-list">
        {configs.map(config => (
          <ModelConfigCard
            key={config.id}
            config={config}
            onEdit={() => {/* ... */}}
            onDelete={() => {/* ... */}}
          />
        ))}
      </div>

      <Modal open={isFormOpen} onClose={() => setIsFormOpen(false)}>
        <ModelConfigForm onSave={(config) => {
          useModelConfigStore.getState().addConfig(config);
          setIsFormOpen(false);
        }} />
      </Modal>
    </div>
  );
};
```

---

## 推荐的模型列表

基于 LeadAgent 的需求（工具调用、代码生成、推理能力），推荐以下模型：

### 1. OpenAI 系列
| 模型 | 用途 | API Key 来源 |
|------|------|-------------|
| `gpt-4o` | 最强推理能力，适合复杂任务 | https://platform.openai.com/api-keys |
| `gpt-4o-mini` | 性价比高，适合日常对话 | 同上 |
| `gpt-4-turbo` | 平衡性能和成本 | 同上 |

**Base URL**: `https://api.openai.com/v1`

### 2. Anthropic Claude 系列
| 模型 | 用途 | API Key 来源 |
|------|------|-------------|
| `claude-3-5-sonnet-20241022` | 最新 Claude，代码能力强 | https://console.anthropic.com/settings/keys |
| `claude-3-opus-20240229` | 最强推理，适合复杂任务 | 同上 |
| `claude-3-haiku-20240307` | 快速响应，低成本 | 同上 |

**Base URL**: `https://api.anthropic.com/v1`

### 3. DeepSeek 系列（已支持）
| 模型 | 用途 | API Key 来源 |
|------|------|-------------|
| `deepseek-chat` | 通用对话，性价比极高 | https://platform.deepseek.com/api_keys |
| `deepseek-coder` | 代码专用模型 | 同上 |

**Base URL**: `https://api.deepseek.com`

### 4. 国内模型（Volcengine 已支持）
| 模型 | 用途 | API Key 来源 |
|------|------|-------------|
| `doubao-pro-32k` | 字节豆包，长上下文 | https://console.volcengine.com/ark |
| `doubao-lite-32k` | 轻量版，低成本 | 同上 |

**Base URL**: `https://ark.cn-beijing.volces.com/api/v3`

### 5. 其他推荐
| Provider | 模型 | 用途 | Base URL |
|----------|------|------|----------|
| Moonshot | `moonshot-v1-8k` | 国内 Kimi，长上下文 | `https://api.moonshot.cn/v1` |
| Zhipu | `glm-4` | 智谱 AI，中文友好 | `https://open.bigmodel.cn/api/paas/v4` |
| Groq | `llama-3.1-70b-versatile` | 超快推理速度 | `https://api.groq.com/openai/v1` |

---

## 实现步骤

### Phase 1: 后端基础设施（2-3 小时）
1. ✅ 创建 `RuntimeProviderConfig` 类型
2. ✅ 实现 `UniversalChatAgent` 替代 `DeepSeekToolChatAgent`
3. ✅ 扩展 `ModelsFactory.generateText` 支持运行时配置
4. ✅ 更新 IPC 类型和 handler

### Phase 2: 前端数据层（1-2 小时）
1. ✅ 创建 `useModelConfigStore`
2. ✅ 扩展 `ChatSession` 类型
3. ✅ 实现配置持久化（localStorage）

### Phase 3: 前端 UI 组件（3-4 小时）
1. ✅ 实现 `ModelSelector` 组件
2. ✅ 实现 `ModelConfigForm` 组件
3. ✅ 实现 `ModelConfigCard` 组件
4. ✅ 集成到 `ChatInterface`

### Phase 4: 设置页面（2-3 小时）
1. ✅ 创建 `ModelsSettings` 页面
2. ✅ 添加路由和导航
3. ✅ 实现配置的增删改查

### Phase 5: 测试和优化（2-3 小时）
1. ✅ 测试不同 provider 的切换
2. ✅ 测试 API Key 验证
3. ✅ 错误处理和用户提示
4. ✅ 性能优化（配置缓存）

**总计：10-15 小时**

---

## 安全考虑

1. **API Key 存储**：
   - 前端使用 localStorage 加密存储（可选）
   - 后端不持久化用户 API Key
   - 仅在内存中使用

2. **API Key 验证**：
   - 添加 IPC handler `model:validate-config` 验证配置
   - 在保存前测试连接

3. **错误处理**：
   - API Key 无效时提示用户
   - 网络错误时自动重试
   - 配额超限时友好提示

---

## 未来扩展

1. **模型能力检测**：自动检测模型是否支持工具调用
2. **成本追踪**：记录每个模型的 token 使用量
3. **模型对比**：同一问题用不同模型回答，对比结果
4. **团队共享**：支持团队级别的模型配置共享
5. **本地模型**：支持 Ollama 等本地模型

---

## 问题和决策

### Q1: API Key 是否需要加密存储？
**决策**：初期使用明文存储在 localStorage，后续可以使用 Electron 的 safeStorage API 加密。

### Q2: 是否需要支持多个 API Key（同一 provider）？
**决策**：初期不支持，一个 provider 只能配置一个 API Key。后续可以扩展为多账号管理。

### Q3: 模型配置是否需要同步到后端配置文件？
**决策**：不需要。用户级配置仅存储在前端，后端配置文件作为默认值。

### Q4: 是否需要支持自定义 provider？
**决策**：初期不支持。后续可以添加 "Custom" provider 类型，允许用户输入任意 OpenAI 兼容的 API。

---

## 总结

本方案通过以下方式实现动态模型切换：

1. **会话级配置**：每个会话独立选择模型
2. **用户级管理**：前端管理 API Key，无需修改配置文件
3. **运行时切换**：无需重启应用即可切换模型
4. **类 Cursor 体验**：简洁的模型选择器 + 配置管理页面

核心优势：
- ✅ 灵活性高（会话级配置）
- ✅ 安全性好（API Key 不写入文件）
- ✅ 用户体验好（类似 Cursor）
- ✅ 扩展性强（易于添加新 provider）
