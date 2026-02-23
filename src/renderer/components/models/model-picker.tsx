import { useMemo, useState } from "react";
import type { ModelProvider, ModelsCatalogProvider } from "../../../shared/ipc";

type ModelPickerProps = {
  providers: ModelsCatalogProvider[];
  selectedProvider?: ModelProvider;
  selectedModelId?: string;
  onProviderChange: (provider: ModelProvider) => void;
  onModelChange: (modelId: string) => void;
  allowProviderSwitch?: boolean;
};

const providerBadgeClass = (isActive: boolean): string => {
  return isActive
    ? "border-sky-500 bg-sky-50 text-sky-700"
    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300";
};

export const ModelPicker = ({
  providers,
  selectedProvider,
  selectedModelId,
  onProviderChange,
  onModelChange,
  allowProviderSwitch = true
}: ModelPickerProps) => {
  const [query, setQuery] = useState("");

  const activeProvider = useMemo(() => {
    if (!selectedProvider) {
      return providers[0];
    }
    return providers.find((provider) => provider.id === selectedProvider) ?? providers[0];
  }, [providers, selectedProvider]);

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!activeProvider) {
      return [];
    }

    if (!normalizedQuery) {
      return activeProvider.models;
    }

    return activeProvider.models.filter((model) => {
      return (
        model.id.toLowerCase().includes(normalizedQuery) ||
        model.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeProvider, query]);

  if (providers.length === 0) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        当前目录源没有可执行模型，请检查目录源配置或内容。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allowProviderSwitch ? (
        <div className="flex flex-wrap gap-2">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => onProviderChange(provider.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${providerBadgeClass(
                provider.id === activeProvider?.id
              )}`}
            >
              {provider.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Provider: {activeProvider?.name ?? "-"}
        </div>
      )}

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索模型 ID / 名称"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        {filteredModels.length === 0 ? (
          <div className="text-sm text-slate-500">未找到匹配模型</div>
        ) : (
          filteredModels.map((model) => {
            const isSelected = model.id === selectedModelId;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => onModelChange(model.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{model.name}</div>
                    <div className="text-xs text-slate-500">{model.id}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {model.capabilities.toolCall ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        tool_call
                      </span>
                    ) : null}
                    {model.capabilities.reasoning ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        reasoning
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
