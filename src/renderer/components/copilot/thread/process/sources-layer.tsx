import type { SourceItem } from "./trace-utils";

type SourcesLayerProps = {
  sources: SourceItem[];
};

export const SourcesLayer = ({ sources }: SourcesLayerProps) => {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-zinc-500">Sources</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {sources.map((source) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="group rounded-lg border border-zinc-200 bg-white px-3 py-2 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
          >
            <p className="truncate text-xs font-medium text-zinc-800 group-hover:text-emerald-800">{source.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">{source.url}</p>
          </a>
        ))}
      </div>
    </div>
  );
};
