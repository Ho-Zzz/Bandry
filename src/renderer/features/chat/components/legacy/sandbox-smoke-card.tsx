type SandboxAction = "list" | "read" | "exec";

type SandboxSmokeCardProps = {
  sandboxPath: string;
  sandboxOutput: string;
  sandboxBusy: boolean;
  onSandboxPathChange: (value: string) => void;
  onSandboxAction: (action: SandboxAction) => void;
};

export const SandboxSmokeCard = ({
  sandboxPath,
  sandboxOutput,
  sandboxBusy,
  onSandboxPathChange,
  onSandboxAction
}: SandboxSmokeCardProps) => {
  return (
    <div className="updates">
      <h2>Sandbox smoke test</h2>
      <label htmlFor="sandbox-path">Virtual path</label>
      <input
        id="sandbox-path"
        value={sandboxPath}
        onChange={(event) => onSandboxPathChange(event.target.value)}
        placeholder="/mnt/workspace"
      />
      <div className="button-row">
        <button type="button" disabled={sandboxBusy} onClick={() => onSandboxAction("list")}>
          List Dir
        </button>
        <button type="button" disabled={sandboxBusy} onClick={() => onSandboxAction("read")}>
          Read File
        </button>
        <button type="button" disabled={sandboxBusy} onClick={() => onSandboxAction("exec")}>
          Exec ls
        </button>
      </div>
      <pre className="output-box">{sandboxOutput}</pre>
    </div>
  );
};
