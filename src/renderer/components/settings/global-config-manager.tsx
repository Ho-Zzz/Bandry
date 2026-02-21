import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Switch
} from "@heroui/react";
import type {
  GlobalSettingsState,
  ModelProvider,
  SettingsRuntimeRole
} from "../../../shared/ipc";

const PROVIDERS: ModelProvider[] = ["openai", "deepseek", "volcengine"];
const ROLE_LABELS: Array<{ role: SettingsRuntimeRole; label: string }> = [
  { role: "chat.default", label: "Chat 默认模型" },
  { role: "lead.planner", label: "LeadAgent 规划模型" },
  { role: "lead.synthesizer", label: "LeadAgent 汇总模型" },
  { role: "sub.researcher", label: "Researcher 模型" },
  { role: "sub.bash_operator", label: "BashOperator 模型" },
  { role: "sub.writer", label: "Writer 模型" },
  { role: "memory.fact_extractor", label: "记忆事实提取模型" }
];

const createNewProfile = (provider: ModelProvider): GlobalSettingsState["modelProfiles"][number] => {
  const now = Date.now();
  return {
    id: `profile_${provider}_${now}`,
    name: `${provider}-profile-${now.toString().slice(-4)}`,
    provider,
    model: "",
    enabled: true,
    temperature: 0.2
  };
};

export const GlobalConfigManager = () => {
  const [state, setState] = useState<GlobalSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  const profiles = useMemo(() => state?.modelProfiles ?? [], [state]);

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
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Loading settings...</div>;
  }

  if (!state) {
    return <div className="text-sm text-red-500 p-6">Settings state unavailable.</div>;
  }

  const updateProviderField = (
    provider: ModelProvider,
    field: keyof GlobalSettingsState["providers"][ModelProvider],
    value: string | boolean
  ) => {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        providers: {
          ...current.providers,
          [provider]: {
            ...current.providers[provider],
            [field]: value
          }
        }
      };
    });
  };

  const updateProfileField = (
    profileId: string,
    field: keyof GlobalSettingsState["modelProfiles"][number],
    value: string | number | boolean
  ) => {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        modelProfiles: current.modelProfiles.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                [field]: value
              }
            : profile
        )
      };
    });
  };

  const removeProfile = (profileId: string) => {
    setState((current) => {
      if (!current) return current;
      const nextProfiles = current.modelProfiles.filter((profile) => profile.id !== profileId);
      const fallback = nextProfiles[0]?.id ?? "";
      const nextRouting = { ...current.routing };
      for (const role of Object.keys(nextRouting) as SettingsRuntimeRole[]) {
        if (nextRouting[role] === profileId) {
          nextRouting[role] = fallback;
        }
      }
      return {
        ...current,
        modelProfiles: nextProfiles,
        routing: nextRouting
      };
    });
  };

  const handleSave = async () => {
    if (!state) {
      return;
    }
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
        <CardHeader>
          <h3 className="text-lg font-semibold">模型接入（OpenAI Compatible）</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          {PROVIDERS.map((provider) => {
            const cfg = state.providers[provider];
            return (
              <div key={provider} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{provider}</div>
                  <Switch
                    isSelected={cfg.enabled}
                    onValueChange={(value) => updateProviderField(provider, "enabled", value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Base URL"
                    value={cfg.baseUrl}
                    onValueChange={(value) => updateProviderField(provider, "baseUrl", value)}
                  />
                  <Input
                    label="Default Model"
                    value={cfg.model}
                    onValueChange={(value) => updateProviderField(provider, "model", value)}
                  />
                  <Input
                    label="API Key"
                    type="password"
                    value={cfg.apiKey}
                    onValueChange={(value) => updateProviderField(provider, "apiKey", value)}
                  />
                  {provider === "openai" ? (
                    <Input
                      label="Org ID (optional)"
                      value={cfg.orgId ?? ""}
                      onValueChange={(value) => updateProviderField(provider, "orgId", value)}
                    />
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">模型档案（Model Profiles）</h3>
          <div className="flex gap-2">
            {PROVIDERS.map((provider) => (
              <Button
                key={provider}
                size="sm"
                variant="flat"
                onPress={() => {
                  setState((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      modelProfiles: [...current.modelProfiles, createNewProfile(provider)]
                    };
                  });
                }}
              >
                + {provider}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{profile.id}</div>
                <div className="flex items-center gap-2">
                  <Switch
                    isSelected={profile.enabled}
                    onValueChange={(value) => updateProfileField(profile.id, "enabled", value)}
                  />
                  <Button size="sm" color="danger" variant="light" onPress={() => removeProfile(profile.id)}>
                    删除
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label="Profile Name"
                  value={profile.name}
                  onValueChange={(value) => updateProfileField(profile.id, "name", value)}
                />
                <Select
                  label="Provider"
                  selectedKeys={[profile.provider]}
                  onChange={(event) =>
                    updateProfileField(profile.id, "provider", event.target.value as ModelProvider)
                  }
                >
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider}>{provider}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="Model"
                  value={profile.model}
                  onValueChange={(value) => updateProfileField(profile.id, "model", value)}
                />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">角色模型绑定</h3>
        </CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLE_LABELS.map((item) => (
            <Select
              key={item.role}
              label={item.label}
              selectedKeys={[state.routing[item.role] ?? ""]}
              onChange={(event) => {
                const profileId = event.target.value;
                setState((current) => {
                  if (!current) return current;
                  return {
                    ...current,
                    routing: {
                      ...current.routing,
                      [item.role]: profileId
                    }
                  };
                });
              }}
            >
              {profiles.map((profile) => (
                <SelectItem key={profile.id}>
                  {profile.name} ({profile.provider}/{profile.model})
                </SelectItem>
              ))}
            </Select>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">记忆能力（OpenViking）</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>启用 Memory Middleware</span>
            <Switch
              isSelected={state.memory.enableMemory}
              onValueChange={(value) =>
                setState((current) => {
                  if (!current) return current;
                  return {
                    ...current,
                    memory: {
                      ...current.memory,
                      enableMemory: value
                    }
                  };
                })
              }
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="OpenViking Host"
              value={state.memory.openviking.host}
              onValueChange={(value) =>
                setState((current) => {
                  if (!current) return current;
                  return {
                    ...current,
                    memory: {
                      ...current.memory,
                      openviking: {
                        ...current.memory.openviking,
                        host: value
                      }
                    }
                  };
                })
              }
            />
            <Input
              label="Port"
              value={String(state.memory.openviking.port)}
              onValueChange={(value) =>
                setState((current) => {
                  if (!current) return current;
                  return {
                    ...current,
                    memory: {
                      ...current.memory,
                      openviking: {
                        ...current.memory.openviking,
                        port: Number(value) || 0
                      }
                    }
                  };
                })
              }
            />
            <Input
              label="Top K"
              value={String(state.memory.openviking.memoryTopK)}
              onValueChange={(value) =>
                setState((current) => {
                  if (!current) return current;
                  return {
                    ...current,
                    memory: {
                      ...current.memory,
                      openviking: {
                        ...current.memory.openviking,
                        memoryTopK: Number(value) || 0
                      }
                    }
                  };
                })
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
                  setState((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      tools: {
                        ...current.tools,
                        webSearch: {
                          ...current.tools.webSearch,
                          enabled: value
                        }
                      }
                    };
                  })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="API Key"
                type="password"
                value={state.tools.webSearch.apiKey}
                onValueChange={(value) =>
                  setState((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      tools: {
                        ...current.tools,
                        webSearch: {
                          ...current.tools.webSearch,
                          apiKey: value
                        }
                      }
                    };
                  })
                }
              />
              <Input
                label="Base URL"
                value={state.tools.webSearch.baseUrl}
                onValueChange={(value) =>
                  setState((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      tools: {
                        ...current.tools,
                        webSearch: {
                          ...current.tools.webSearch,
                          baseUrl: value
                        }
                      }
                    };
                  })
                }
              />
              <Input
                label="Max Results"
                value={String(state.tools.webSearch.maxResults)}
                onValueChange={(value) =>
                  setState((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      tools: {
                        ...current.tools,
                        webSearch: {
                          ...current.tools.webSearch,
                          maxResults: Number(value) || 1
                        }
                      }
                    };
                  })
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
                  setState((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      tools: {
                        ...current.tools,
                        webFetch: {
                          ...current.tools.webFetch,
                          enabled: value
                        }
                      }
                    };
                  })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="API Key"
                type="password"
                value={state.tools.webFetch.apiKey}
                onValueChange={(value) =>
                  setState((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      tools: {
                        ...current.tools,
                        webFetch: {
                          ...current.tools.webFetch,
                          apiKey: value
                        }
                      }
                    };
                  })
                }
              />
              <Input
                label="Base URL"
                value={state.tools.webFetch.baseUrl}
                onValueChange={(value) =>
                  setState((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      tools: {
                        ...current.tools,
                        webFetch: {
                          ...current.tools.webFetch,
                          baseUrl: value
                        }
                      }
                    };
                  })
                }
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-3">
        <Button color="primary" onPress={handleSave} isLoading={saving}>
          保存全局配置
        </Button>
        {message ? <span className="text-sm text-gray-600">{message}</span> : null}
      </div>
    </div>
  );
};
