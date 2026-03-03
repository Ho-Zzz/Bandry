type LeadRouteAlertProps = {
  onOpenModelStudio: () => void;
};

export const LeadRouteAlert = ({ onOpenModelStudio }: LeadRouteAlertProps) => {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-amber-900">LeadAgent route is not ready</h2>
        <p className="mt-2 text-sm text-amber-800">
          Configure runnable models for <code>lead.planner</code> and <code>lead.synthesizer</code> in Model Studio.
        </p>
        <button
          type="button"
          onClick={onOpenModelStudio}
          className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Open Model Studio
        </button>
      </div>
    </div>
  );
};
