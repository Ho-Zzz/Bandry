import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import type {
  ModelProvider,
  ModelsCatalogListResult,
  ModelsConnectResult
} from "../../../shared/ipc";
import { ModelPicker } from "./model-picker";

type ConnectModelModalProps = {
  isOpen: boolean;
  catalog: ModelsCatalogListResult | null;
  preferredProvider?: ModelProvider;
  providerCredentials?: Partial<
    Record<
      ModelProvider,
      {
        apiKey: string;
        baseUrl: string;
      }
    >
  >;
  onClose: () => void;
  onConnected: (result: ModelsConnectResult) => Promise<void> | void;
};

export const ConnectModelModal = ({
  isOpen,
  catalog,
  preferredProvider,
  providerCredentials,
  onClose,
  onConnected
}: ConnectModelModalProps) => {
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState<ModelProvider | undefined>(undefined);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelId, setModelId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initialProvider = preferredProvider ?? catalog?.providers[0]?.id;
    const initialCredential = initialProvider
      ? providerCredentials?.[initialProvider]
      : undefined;
    const initialApiKey = initialCredential?.apiKey ?? "";
    const initialBaseUrl = initialCredential?.baseUrl ?? "";
    const shouldSkipCredential = Boolean(preferredProvider && initialApiKey.trim());

    setStep(preferredProvider ? (shouldSkipCredential ? 3 : 2) : 1);
    setProvider(initialProvider);
    setApiKey(initialApiKey);
    setBaseUrl(initialBaseUrl);
    setModelId("");
    setSubmitting(false);
    setMessage("");
  }, [catalog, isOpen, preferredProvider, providerCredentials]);

  const selectedProvider = useMemo(() => {
    if (!provider || !catalog) {
      return undefined;
    }
    return catalog.providers.find((item) => item.id === provider);
  }, [catalog, provider]);

  if (!isOpen) {
    return null;
  }

  const canMoveNext = (() => {
    if (step === 1) {
      return Boolean(provider);
    }
    if (step === 2) {
      return apiKey.trim().length > 0;
    }
    return false;
  })();

  const moveNext = () => {
    if (!canMoveNext) {
      return;
    }
    if (step === 1 && provider) {
      const credential = providerCredentials?.[provider];
      setApiKey(credential?.apiKey ?? "");
      setBaseUrl(credential?.baseUrl ?? "");
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const movePrev = () => {
    setStep((current) => Math.max(1, current - 1));
  };

  const handleConnect = async () => {
    if (!provider || !modelId || !apiKey.trim()) {
      setMessage("请先完成 Provider、API Key 与模型选择");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const result = await window.api.modelsConnect({
        provider,
        modelId,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || undefined
      });
      await onConnected(result);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "连接模型失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Connect Model</h2>
            <p className="text-xs text-slate-500">Step {step} / 3</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Step 1: Connect a provider</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {(catalog?.providers ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setProvider(item.id);
                      setModelId("");
                    }}
                    className={`rounded-xl border px-3 py-3 text-left ${
                      provider === item.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.models.length} models</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Step 2: Fill provider credentials (API Key required)
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="API Key (required)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="Base URL (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Step 3: Select model from {selectedProvider?.name ?? provider}
              </p>
              <ModelPicker
                providers={catalog?.providers ?? []}
                selectedProvider={provider}
                selectedModelId={modelId}
                allowProviderSwitch={false}
                onProviderChange={(nextProvider) => {
                  setProvider(nextProvider);
                  setModelId("");
                }}
                onModelChange={setModelId}
              />
            </div>
          ) : null}

          {message ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {message}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={movePrev}
            disabled={step === 1 || submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
          >
            Back
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={moveNext}
              disabled={!canMoveNext || submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={submitting || !modelId || !apiKey.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
