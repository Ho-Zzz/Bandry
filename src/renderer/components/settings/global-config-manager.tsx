import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Brain, CheckCircle2, XCircle } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Input, Switch } from "@heroui/react";
import type { GlobalSettingsState, MemoryStatusResult } from "../../../shared/ipc";

export const GlobalConfigManager = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<GlobalSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});

  const isApiKeyVisible = (fieldId: string) => Boolean(visibleApiKeys[fieldId]);
  const toggleApiKeyVisibility = (fieldId: string) => {
    setVisibleApiKeys((current) => ({
      ...current,
      [fieldId]: !current[fieldId]
    }));
  };
  const renderApiKeyToggle = (fieldId: string) => (
    <button
      type="button"
      className="text-gray-500 hover:text-gray-700 transition-colors"
      aria-label={isApiKeyVisible(fieldId) ? "隐藏 API Key" : "显示 API Key"}
      onClick={() => toggleApiKeyVisibility(fieldId)}
    >
      {isApiKeyVisible(fieldId) ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  const [memoryStatus, setMemoryStatus] = useState<MemoryStatusResult | null>(null);

  const refreshMemoryStatus = useCallback(async () => {
    try {
      const result = await window.api.memoryStatus();
      setMemoryStatus(result);
    } catch {
      setMemoryStatus(null);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await window.api.getSettingsState();
        setState(result);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "加载配置失败");
      } finally {
        setLoading(false);
      }
    };
    void load();
    void refreshMemoryStatus();
  }, [refreshMemoryStatus]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading settings...</div>;
  }

  if (!state) {
    return <div className="p-6 text-sm text-red-500">Settings state unavailable.</div>;
  }

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await window.api.saveSettingsState({ state });
      setMessage(result.message);
      if (result.ok) {
        const latest = await window.api.getSettingsState();
        setState(latest);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-6xl">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">模型接入</h3>
          <Button
            color="primary"
            variant="flat"
            endContent={<ArrowRight size={14} />}
            onPress={() => navigate("/model-studio")}
          >
            打开 Model Studio
          </Button>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600">
            模型连接、模型选择与默认路由已迁移到 Model Studio。Settings 页面不再编辑 provider/profile。
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-indigo-600" />
            <h3 className="text-lg font-semibold">记忆能力（OpenViking）</h3>
          </div>
          {memoryStatus ? (
            <div className="flex items-center gap-1.5 text-xs">
              {memoryStatus.running ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span className="text-emerald-700">运行中</span>
                  {memoryStatus.url ? (
                    <span className="ml-1 text-gray-400">{memoryStatus.url}</span>
                  ) : null}
                </>
              ) : memoryStatus.enabled ? (
                <>
                  <XCircle size={14} className="text-amber-500" />
                  <span className="text-amber-700">未运行</span>
                </>
              ) : (
                <>
                  <XCircle size={14} className="text-gray-400" />
                  <span className="text-gray-500">已禁用</span>
                </>
              )}
              <Button
                variant="light"
                size="sm"
                className="ml-2 h-6 min-w-0 px-2 text-xs"
                onPress={() => { void refreshMemoryStatus(); }}
              >
                刷新
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <span className="font-medium">启用 Memory Middleware</span>
              <p className="text-xs text-gray-500 mt-0.5">开启后 Agent 会在对话中注入历史记忆上下文，并自动沉淀对话记忆</p>
            </div>
            <Switch
              isSelected={state.memory.enableMemory}
              onValueChange={(value) =>
                setState((current) => (
                  current
                    ? {
                        ...current,
                        memory: {
                          ...current.memory,
                          enableMemory: value
                        }
                      }
                    : current
                ))
              }
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              label="OpenViking Host"
              value={state.memory.openviking.host}
              onValueChange={(value) =>
                setState((current) => (
                  current
                    ? {
                        ...current,
                        memory: {
                          ...current.memory,
                          openviking: {
                            ...current.memory.openviking,
                            host: value
                          }
                        }
                      }
                    : current
                ))
              }
            />
            <Input
              label="Port"
              value={String(state.memory.openviking.port)}
              onValueChange={(value) =>
                setState((current) => (
                  current
                    ? {
                        ...current,
                        memory: {
                          ...current.memory,
                          openviking: {
                            ...current.memory.openviking,
                            port: Number(value) || 0
                          }
                        }
                      }
                    : current
                ))
              }
            />
            <Input
              label="Top K"
              description="每次检索返回的最大记忆条数"
              value={String(state.memory.openviking.memoryTopK)}
              onValueChange={(value) =>
                setState((current) => (
                  current
                    ? {
                        ...current,
                        memory: {
                          ...current.memory,
                          openviking: {
                            ...current.memory.openviking,
                            memoryTopK: Number(value) || 0
                          }
                        }
                      }
                    : current
                ))
              }
            />
            <Input
              label="Score Threshold"
              description="低于此分数的记忆将被过滤"
              value={String(state.memory.openviking.memoryScoreThreshold)}
              onValueChange={(value) =>
                setState((current) => (
                  current
                    ? {
                        ...current,
                        memory: {
                          ...current.memory,
                          openviking: {
                            ...current.memory.openviking,
                            memoryScoreThreshold: Number(value) || 0
                          }
                        }
                      }
                    : current
                ))
              }
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">内部工具配置（优先）</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">web_search (Tavily)</span>
              <Switch
                isSelected={state.tools.webSearch.enabled}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            webSearch: {
                              ...current.tools.webSearch,
                              enabled: value
                            }
                          }
                        }
                      : current
                  ))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="API Key"
                type={isApiKeyVisible("tools.webSearch.apiKey") ? "text" : "password"}
                value={state.tools.webSearch.apiKey}
                endContent={renderApiKeyToggle("tools.webSearch.apiKey")}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            webSearch: {
                              ...current.tools.webSearch,
                              apiKey: value
                            }
                          }
                        }
                      : current
                  ))
                }
              />
              <Input
                label="Base URL"
                value={state.tools.webSearch.baseUrl}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            webSearch: {
                              ...current.tools.webSearch,
                              baseUrl: value
                            }
                          }
                        }
                      : current
                  ))
                }
              />
              <Input
                label="Max Results"
                value={String(state.tools.webSearch.maxResults)}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            webSearch: {
                              ...current.tools.webSearch,
                              maxResults: Number(value) || 1
                            }
                          }
                        }
                      : current
                  ))
                }
              />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">web_fetch (Jina Reader)</span>
              <Switch
                isSelected={state.tools.webFetch.enabled}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            webFetch: {
                              ...current.tools.webFetch,
                              enabled: value
                            }
                          }
                        }
                      : current
                  ))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="API Key"
                type={isApiKeyVisible("tools.webFetch.apiKey") ? "text" : "password"}
                value={state.tools.webFetch.apiKey}
                endContent={renderApiKeyToggle("tools.webFetch.apiKey")}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            webFetch: {
                              ...current.tools.webFetch,
                              apiKey: value
                            }
                          }
                        }
                      : current
                  ))
                }
              />
              <Input
                label="Base URL"
                value={state.tools.webFetch.baseUrl}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            webFetch: {
                              ...current.tools.webFetch,
                              baseUrl: value
                            }
                          }
                        }
                      : current
                  ))
                }
              />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">github_search (GitHub API)</span>
                <p className="text-xs text-gray-500 mt-1">搜索 GitHub 仓库、代码等。API Key 可选，但可提高速率限制。</p>
              </div>
              <Switch
                isSelected={state.tools.githubSearch.enabled}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            githubSearch: {
                              ...current.tools.githubSearch,
                              enabled: value
                            }
                          }
                        }
                      : current
                  ))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="API Key (Optional)"
                type={isApiKeyVisible("tools.githubSearch.apiKey") ? "text" : "password"}
                value={state.tools.githubSearch.apiKey}
                placeholder="ghp_xxxx"
                endContent={renderApiKeyToggle("tools.githubSearch.apiKey")}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            githubSearch: {
                              ...current.tools.githubSearch,
                              apiKey: value
                            }
                          }
                        }
                      : current
                  ))
                }
              />
              <Input
                label="Base URL"
                value={state.tools.githubSearch.baseUrl}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            githubSearch: {
                              ...current.tools.githubSearch,
                              baseUrl: value
                            }
                          }
                        }
                      : current
                  ))
                }
              />
              <Input
                label="Max Results"
                value={String(state.tools.githubSearch.maxResults)}
                onValueChange={(value) =>
                  setState((current) => (
                    current
                      ? {
                          ...current,
                          tools: {
                            ...current.tools,
                            githubSearch: {
                              ...current.tools.githubSearch,
                              maxResults: Number(value) || 1
                            }
                          }
                        }
                      : current
                  ))
                }
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-3">
        <Button color="primary" onPress={handleSave} isLoading={saving}>
          保存设置
        </Button>
        {message ? <span className="text-sm text-gray-600">{message}</span> : null}
      </div>
    </div>
  );
};
