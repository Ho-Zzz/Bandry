import type { RuntimeConfigSummary, RuntimeProviderSummary } from "../../../../../shared/ipc";

type RuntimeConfigCardProps = {
  configSummary: RuntimeConfigSummary | null;
};

export const RuntimeConfigCard = ({ configSummary }: RuntimeConfigCardProps) => {
  return (
    <div className="updates">
      <h2>Runtime config</h2>
      {!configSummary ? <p>No config loaded.</p> : null}
      {configSummary ? (
        <>
          <article className="update-item">
            <strong>Default</strong>
            <span>{configSummary.defaultProvider}</span>
            <span>{configSummary.networkMode}</span>
            <span>{configSummary.defaultModel}</span>
          </article>
          {configSummary.providers.map((provider: RuntimeProviderSummary) => (
            <article key={provider.name} className="update-item">
              <strong>{provider.name}</strong>
              <span>{provider.configured ? "configured" : "missing-key"}</span>
              <span>{provider.enabled ? "enabled" : "disabled"}</span>
              <span>{provider.model}</span>
            </article>
          ))}
          <article className="update-item">
            <strong>sandbox</strong>
            <span>{configSummary.sandbox.virtualRoot}</span>
            <span>{configSummary.sandbox.execTimeoutMs}ms</span>
            <span>{configSummary.sandbox.allowedCommands.join(", ")}</span>
          </article>
        </>
      ) : null}
    </div>
  );
};
