import { useEffect, useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronRight, Crown, Search, Save, TerminalSquare, PenSquare } from "lucide-react";
import { SoulEditor } from "../persona/soul-editor";
import type {
  ConnectedModelResult,
  GlobalSettingsState,
  SettingsRuntimeRole
} from "../../../shared/ipc";

type PresetRole =
  | "lead.planner"
  | "sub.researcher"
  | "sub.bash_operator"
  | "sub.writer";

type PresetCard = {
  role: PresetRole;
  title: string;
  agent: string;
  description: string;
  icon: typeof Crown;
  accentClass: string;
};

const PRESET_CARDS: PresetCard[] = [
  {
    role: "lead.planner",
    title: "Lead",
    agent: "LeadAgent",
    description: "负责整体规划与最终总结（会同时绑定 lead.planner / lead.synthesizer）。",
    icon: Crown,
    accentClass: "text-amber-600 bg-amber-50 border-amber-200"
  },
  {
    role: "sub.researcher",
    title: "Researcher",
    agent: "ResearcherAgent",
    description: "负责检索资料、归纳证据与上下文补全。",
    icon: Search,
    accentClass: "text-sky-600 bg-sky-50 border-sky-200"
  },
  {
    role: "sub.bash_operator",
    title: "Bash Operator",
    agent: "BashOperatorAgent",
    description: "负责命令执行、文件操作与环境检查。",
    icon: TerminalSquare,
    accentClass: "text-emerald-600 bg-emerald-50 border-emerald-200"
  },
  {
    role: "sub.writer",
    title: "Writer",
    agent: "WriterAgent",
    description: "负责结构化写作、总结润色与最终产出。",
    icon: PenSquare,
    accentClass: "text-violet-600 bg-violet-50 border-violet-200"
  }
];

const buildDraftRouting = (
  state: GlobalSettingsState
): Record<PresetRole, string> => {
  const readAssignment = (role: PresetRole): string => {
    return state.routing[role]?.trim() ?? "";
  };

  return {
    "lead.planner": readAssignment("lead.planner"),
    "sub.researcher": readAssignment("sub.researcher"),
    "sub.bash_operator": readAssignment("sub.bash_operator"),
    "sub.writer": readAssignment("sub.writer")
  };
};

const cloneSettingsState = (state: GlobalSettingsState): GlobalSettingsState => {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }

  return JSON.parse(JSON.stringify(state)) as GlobalSettingsState;
};

export const Employees = () => {
  const [settingsState, setSettingsState] = useState<GlobalSettingsState | null>(null);
  const [connectedModels, setConnectedModels] = useState<ConnectedModelResult[]>([]);
  const [draftRouting, setDraftRouting] = useState<Record<PresetRole, string>>({
    "lead.planner": "",
    "sub.researcher": "",
    "sub.bash_operator": "",
    "sub.writer": ""
  });
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<PresetRole | null>(null);
  const [message, setMessage] = useState("");
  const [soulOpen, setSoulOpen] = useState(false);

  const loadAll = async () => {
    try {
      setLoading(true);
      setMessage("");
      const [settings, connected] = await Promise.all([
        window.api.getSettingsState(),
        window.api.modelsListConnected()
      ]);

      const runnableModels = connected.models.filter(
        (model) => model.enabled && model.providerConfigured
      );

      setSettingsState(settings);
      setConnectedModels(runnableModels);
      setDraftRouting(buildDraftRouting(settings));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load people presets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const modelByProfileId = useMemo(() => {
    return new Map(connectedModels.map((model) => [model.profileId, model]));
  }, [connectedModels]);

  const handleSaveBinding = async (role: PresetRole) => {
    if (!settingsState) {
      return;
    }

    const profileId = draftRouting[role];
    if (!profileId) {
      setMessage("请选择模型后再保存。");
      return;
    }

    const modelExists = connectedModels.some((model) => model.profileId === profileId);
    if (!modelExists) {
      setMessage("所选模型不可用，请先在 Model Studio 完成接入并配置凭证。");
      return;
    }

    try {
      setSavingRole(role);
      setMessage("");

      const nextState = cloneSettingsState(settingsState);
      nextState.routing[role as SettingsRuntimeRole] = profileId;
      if (role === "lead.planner") {
        nextState.routing["lead.synthesizer"] = profileId;
      }
      const result = await window.api.saveSettingsState({
        state: nextState
      });
      if (!result.ok) {
        throw new Error(result.message);
      }

      setSettingsState(nextState);
      const title = PRESET_CARDS.find((item) => item.role === role)?.title ?? role;
      if (role === "lead.planner") {
        setMessage(`已更新 ${title} 的模型绑定（lead.planner / lead.synthesizer）。`);
      } else {
        setMessage(`已更新 ${title} 的模型绑定。`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save model binding");
    } finally {
      setSavingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-600">Loading people presets...</div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-[radial-gradient(circle_at_15%_15%,#e2e8f0_0,#f8fafc_38%,#ecfeff_100%)] p-6 md:p-8">
      <div className="mx-auto max-w-[1240px] space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">People</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">Preset digital employee bindings</h1>
              <p className="mt-2 text-sm text-slate-600">
                为 Lead/Researcher/Bash Operator/Writer 绑定已接入模型，驱动多智能体链路。
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">Runnable models</div>
              <div className="text-2xl font-semibold text-slate-900">{connectedModels.length}</div>
            </div>
          </div>
          {message ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {message}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {connectedModels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
              No runnable models found. Please connect model and configure provider credential in Model Studio first.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {PRESET_CARDS.map((card) => {
                const Icon = card.icon;
                const currentProfileId = settingsState?.routing[card.role] ?? "";
                const selectedProfileId = draftRouting[card.role] ?? "";
                const boundModel = currentProfileId
                  ? modelByProfileId.get(currentProfileId)
                  : undefined;
                const leadSynthProfileId = settingsState?.routing["lead.synthesizer"] ?? "";
                const leadSynthModel = leadSynthProfileId
                  ? modelByProfileId.get(leadSynthProfileId)
                  : undefined;
                const isLeadCard = card.role === "lead.planner";
                const hasPendingChange =
                  Boolean(selectedProfileId) &&
                  (selectedProfileId !== currentProfileId ||
                    (isLeadCard && selectedProfileId !== leadSynthProfileId));

                return (
                  <article key={card.role} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg border px-2.5 py-2 ${card.accentClass}`}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
                          <p className="text-xs text-slate-500">{card.agent}</p>
                        </div>
                      </div>
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {card.role}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-600">{card.description}</p>

                    <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Current binding</p>
                      <p className="mt-1 text-sm text-slate-800">
                        {isLeadCard ? (
                          <>
                            Planner:{" "}
                            {boundModel
                              ? `${boundModel.providerName} / ${boundModel.model}`
                              : currentProfileId
                                ? `Unknown (${currentProfileId})`
                                : "Not bound yet"}
                            <br />
                            Synthesizer:{" "}
                            {leadSynthModel
                              ? `${leadSynthModel.providerName} / ${leadSynthModel.model}`
                              : leadSynthProfileId
                                ? `Unknown (${leadSynthProfileId})`
                                : "Not bound yet"}
                          </>
                        ) : boundModel ? (
                          `${boundModel.providerName} / ${boundModel.model}`
                        ) : currentProfileId ? (
                          `Unknown (${currentProfileId})`
                        ) : (
                          "Not bound yet"
                        )}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2">
                      <label className="block text-xs text-slate-500">Select model</label>
                      <select
                        value={selectedProfileId}
                        onChange={(event) =>
                          setDraftRouting((current) => ({
                            ...current,
                            [card.role]: event.target.value
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Select a model profile...</option>
                        {connectedModels.map((model) => (
                          <option key={model.profileId} value={model.profileId}>
                            {model.providerName} / {model.model}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Bot size={12} />
                        {hasPendingChange ? "Unsaved change" : "Synced"}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSaveBinding(card.role)}
                        disabled={savingRole === card.role || !hasPendingChange}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        <Save size={12} />
                        {savingRole === card.role ? "Saving..." : "Save binding"}
                      </button>
                    </div>

                    {isLeadCard && (
                      <>
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <button
                            type="button"
                            onClick={() => setSoulOpen(!soulOpen)}
                            className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                          >
                            {soulOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            Soul & Identity
                          </button>
                        </div>
                        {soulOpen && (
                          <div className="mt-3">
                            <SoulEditor />
                          </div>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
