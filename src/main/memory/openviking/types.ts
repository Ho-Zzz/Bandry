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

export type OpenVikingAddResourceResult = {
  root_uri: string;
  [key: string]: unknown;
};

export type OpenVikingLsEntry = {
  name: string;
  uri: string;
  type: "file" | "directory";
  [key: string]: unknown;
};

export type OpenVikingLsResult = OpenVikingLsEntry[];

export type OpenVikingGlobResult = {
  matches: string[];
  [key: string]: unknown;
};

export type OpenVikingReadResult = {
  content: string;
  uri: string;
  [key: string]: unknown;
};

export type OpenVikingAbstractResult = {
  abstract: string;
  uri: string;
  [key: string]: unknown;
};

export type OpenVikingOverviewResult = {
  overview: string;
  uri: string;
  [key: string]: unknown;
};
