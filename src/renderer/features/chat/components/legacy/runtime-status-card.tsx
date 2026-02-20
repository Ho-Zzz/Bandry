import type { PingState } from "../../types";

type RuntimeStatusCardProps = {
  pingState: PingState;
  isLoadingConfig: boolean;
  onPing: () => void;
  onReloadConfig: () => void;
};

export const RuntimeStatusCard = ({
  pingState,
  isLoadingConfig,
  onPing,
  onReloadConfig
}: RuntimeStatusCardProps) => {
  return (
    <div className="updates">
      <h2>Runtime status</h2>
      <code>
        IPC status:
        {" "}
        {pingState}
      </code>
      <div className="button-row">
        <button type="button" onClick={onPing} disabled={pingState === "checking"}>
          {pingState === "checking" ? "Checking..." : "IPC Health Check"}
        </button>
        <button type="button" onClick={onReloadConfig} disabled={isLoadingConfig}>
          {isLoadingConfig ? "Loading..." : "Reload Config"}
        </button>
      </div>
    </div>
  );
};
