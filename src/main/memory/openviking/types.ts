import type { ChildProcessWithoutNullStreams } from "node:child_process";

export type OpenVikingRuntime = {
  host: string;
  port: number;
  url: string;
  apiKey: string;
  agfsPort: number;
  configPath: string;
  dataDir: string;
};

export type OpenVikingLaunchResult = {
  runtime: OpenVikingRuntime;
  child: ChildProcessWithoutNullStreams;
};

export type OpenVikingMatchedContext = {
  uri: string;
  abstract?: string;
  overview?: string;
  score?: number;
  context_type?: string;
  category?: string;
  match_reason?: string;
  [key: string]: unknown;
};

export type OpenVikingFindResult = {
  memories?: OpenVikingMatchedContext[];
  resources?: OpenVikingMatchedContext[];
  skills?: OpenVikingMatchedContext[];
  total?: number;
  [key: string]: unknown;
};
