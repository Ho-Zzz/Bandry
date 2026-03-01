import { useCallback, useEffect, useMemo, useState } from "react";
import { Cpu, KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import type {
  ConnectedModelResult,
  GlobalSettingsState,
  ModelProvider,
  ModelsCatalogListResult,
  ModelsListConnectedResult
} from "../../../shared/ipc";
import { MODEL_PROVIDER_NAME_MAP } from "../../../shared/model-providers";
import { ConnectModelModal } from "../models/connect-model-modal";

type CredentialEditorState = {
  provider: ModelProvider;
  apiKey: string;
  baseUrl: string;
  orgId: string;
  linkedModels: ConnectedModelResult[];
};

type ProviderCredentialSnapshot = {
  apiKey: string;
  baseUrl: string;
};

const providerLabel = (provider: ModelProvider): string => {
  return MODEL_PROVIDER_NAME_MAP[provider] ?? provider;
};

export const ModelStudio = () => {
  const [catalog, setCatalog] = useState<ModelsCatalogListResult | null>(null);
  const [connected, setConnected] = useState<ModelsListConnectedResult | null>(null);
  const [settingsState, setSettingsState] = useState<GlobalSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectPreferredProvider, setConnectPreferredProvider] = useState<ModelProvider | undefined>(undefined);
  const [credentialEditor, setCredentialEditor] = useState<CredentialEditorState | null>(null);
  const [savingCredential, setSavingCredential] = useState(false);

  const loadConnected = useCallback(async () => {
    const [connectedResult, settings] = await Promise.all([
      window.api.modelsListConnected(),
      window.api.getSettingsState()
    ]);
    setConnected(connectedResult);
    setSettingsState(settings);
  }, []);

  const loadCatalog = useCallback(async (refresh = false) => {
    const catalogResult = await window.api.modelsCatalogList({ refresh });
    setCatalog(catalogResult);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      await Promise.all([loadCatalog(false), loadConnected()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load model studio");
    } finally {
      setLoading(false);
    }
  }, [loadCatalog, loadConnected]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const connectedGroups = useMemo(() => {
    const groups = new Map<ModelProvider, ConnectedModelResult[]>();

    for (const model of connected?.models ?? []) {
      const existing = groups.get(model.provider) ?? [];
      existing.push(model);
      groups.set(model.provider, existing);
    }

    for (const list of groups.values()) {
      list.sort((a, b) => a.profileName.localeCompare(b.profileName));
    }

    return groups;
  }, [connected]);

  const connectedProviders = useMemo(() => {
    return Array.from(connectedGroups.keys()).sort((a, b) => {
      return providerLabel(a).localeCompare(providerLabel(b));
    });
  }, [connectedGroups]);

  const catalogByProviderModel = useMemo(() => {
    const map = new Map<string, NonNullable<ModelsCatalogListResult["providers"]>[number]["models"][number]>();
    for (const provider of catalog?.providers ?? []) {
      for (const model of provider.models) {
        map.set(`${provider.id}:${model.id}`, model);
      }
    }
    return map;
  }, [catalog]);

  const providerCredentials = useMemo(() => {
    if (!settingsState) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(settingsState.providers).map(([provider, credential]) => [
        provider,
        {
          apiKey: credential.apiKey,
          baseUrl: credential.baseUrl
        }
      ])
    ) as Record<ModelProvider, ProviderCredentialSnapshot>;
  }, [settingsState]);

  const handleRefreshCatalog = async () => {
    try {
      setRefreshing(true);
      setMessage("");
      await loadCatalog(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to refresh catalog");
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemove = async (profileId: string) => {
    const confirmed = window.confirm("Remove this model profile?");
    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      await window.api.modelsRemove({ profileId });
      await loadConnected();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove model profile");
    }
  };

  const openCredentialEditor = (provider: ModelProvider) => {
    const providerConfig = settingsState?.providers[provider];
    setCredentialEditor({
      provider,
      apiKey: providerConfig?.apiKey ?? "",
      baseUrl: providerConfig?.baseUrl ?? "",
      orgId: provider === "openai" ? providerConfig?.orgId ?? "" : "",
      linkedModels: connectedGroups.get(provider) ?? []
    });
  };

  const saveCredentialEditor = async () => {
    if (!credentialEditor) {
      return;
    }

    try {
      setSavingCredential(true);
      setMessage("");
      await window.api.modelsUpdateProviderCredential({
        provider: credentialEditor.provider,
        apiKey: credentialEditor.apiKey.trim() || undefined,
        baseUrl: credentialEditor.baseUrl.trim() || undefined,
        orgId:
          credentialEditor.provider === "openai"
            ? credentialEditor.orgId.trim() || undefined
            : undefined
      });
      setCredentialEditor(null);
      await loadConnected();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update credential");
    } finally {
      setSavingCredential(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-600">Loading Model Studio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-[linear-gradient(160deg,#f8fafc_0%,#eef2ff_45%,#f1f5f9_100%)]">
      <div className="mx-auto max-w-[1240px] space-y-6 p-6 md:p-8">
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Model Studio</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">Connect and route runnable models</h1>
              <p className="mt-2 text-sm text-slate-600">
                Catalog source: {catalog?.sourceType ?? "-"} · {catalog?.sourceLocation ?? "-"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRefreshCatalog}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                Refresh Catalog
              </button>
              <button
                type="button"
                onClick={() => {
                  setConnectPreferredProvider(undefined);
                  setConnectOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                <Cpu size={15} />
                Connect Model
              </button>
            </div>
          </div>
          {message ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {message}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Connected Models</h2>
          </div>

          {(connected?.models.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
              No connected models yet. Use "Connect Model" to onboard your first model.
            </div>
          ) : (
            <div className="space-y-5">
              {connectedProviders.map((provider) => {
                const models = connectedGroups.get(provider) ?? [];
                return (
                <div key={provider} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{providerLabel(provider)}</h3>
                      <p className="text-xs text-slate-500">
                        {models.length} connected profile(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCredentialEditor(provider)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
                      >
                        <KeyRound size={12} />
                        Update credential
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConnectPreferredProvider(provider);
                          setConnectOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
                      >
                        <Cpu size={12} />
                        Add model
                      </button>
                    </div>
                  </div>

                  {models.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      No profile under this provider
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {models.map((item) => {
                        const catalogModel = catalogByProviderModel.get(`${item.provider}:${item.model}`);
                        return (
                          <div key={item.profileId} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-slate-900">{item.profileName}</div>
                                <div className="text-xs text-slate-500">
                                  {item.providerName} · {item.provider}/{item.model}
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {catalogModel
                                    ? `input: ${catalogModel.capabilities.inputModalities.join(", ")} · output: ${catalogModel.capabilities.outputModalities.join(", ")}`
                                    : "capabilities unknown"}
                                </div>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1">
                                {!item.providerConfigured ? (
                                  <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                    no key
                                  </span>
                                ) : null}
                                {catalogModel?.capabilities.isEmbeddingModel ? (
                                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                    embedding
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleRemove(item.profileId)}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1 text-xs text-rose-700"
                              >
                                <Trash2 size={12} />
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <ConnectModelModal
        isOpen={connectOpen}
        catalog={catalog}
        preferredProvider={connectPreferredProvider}
        providerCredentials={providerCredentials}
        onClose={() => setConnectOpen(false)}
        onConnected={async () => {
          await loadConnected();
        }}
      />

      {credentialEditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Update Credential · {providerLabel(credentialEditor.provider)}
            </h3>
            <p className="mt-1 text-xs text-slate-500">已回填当前配置，可直接修改后保存</p>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600">Linked models</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {credentialEditor.linkedModels.length > 0 ? (
                  credentialEditor.linkedModels.map((model) => (
                    <span
                      key={model.profileId}
                      className="rounded bg-white px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200"
                    >
                      {model.providerName} / {model.model}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No connected model under this provider</span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <input
                value={credentialEditor.apiKey}
                onChange={(event) =>
                  setCredentialEditor((current) => (
                    current
                      ? {
                          ...current,
                          apiKey: event.target.value
                        }
                      : current
                  ))
                }
                placeholder="API key"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={credentialEditor.baseUrl}
                onChange={(event) =>
                  setCredentialEditor((current) => (
                    current
                      ? {
                          ...current,
                          baseUrl: event.target.value
                        }
                      : current
                  ))
                }
                placeholder="Base URL"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {credentialEditor.provider === "openai" ? (
                <input
                  value={credentialEditor.orgId}
                  onChange={(event) =>
                    setCredentialEditor((current) => (
                      current
                        ? {
                            ...current,
                            orgId: event.target.value
                          }
                        : current
                    ))
                  }
                  placeholder="Org ID (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCredentialEditor(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCredentialEditor}
                disabled={savingCredential}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
