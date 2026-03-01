import type {
  OpenVikingAbstractResult,
  OpenVikingAddResourceResult,
  OpenVikingFindResult,
  OpenVikingGlobResult,
  OpenVikingLsResult,
  OpenVikingOverviewResult,
  OpenVikingReadResult
} from "./types";

type OpenVikingApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type OpenVikingApiResponse<T> = {
  status: "ok" | "error";
  result?: T;
  error?: OpenVikingApiError;
  time?: number;
};

export class OpenVikingHttpError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "OpenVikingHttpError";
  }
}

export class OpenVikingHttpClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private timeoutMs: number = 10_000
  ) {}

  async health(): Promise<boolean> {
    try {
      const result = await this.requestRaw<{ status?: string }>("GET", "/health");
      return result.status === "ok";
    } catch {
      return false;
    }
  }

  async createSession(): Promise<{ sessionId: string }> {
    const result = await this.request<{ session_id: string }>("POST", "/api/v1/sessions", {});
    return { sessionId: result.session_id };
  }

  async addSessionMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<void> {
    await this.request("POST", `/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`, {
      role,
      content
    });
  }

  async commitSession(sessionId: string): Promise<void> {
    await this.request("POST", `/api/v1/sessions/${encodeURIComponent(sessionId)}/commit`, {});
  }

  async search(input: {
    query: string;
    sessionId?: string;
    targetUri?: string;
    limit?: number;
    scoreThreshold?: number;
  }): Promise<OpenVikingFindResult> {
    return await this.request<OpenVikingFindResult>("POST", "/api/v1/search/search", {
      query: input.query,
      session_id: input.sessionId,
      target_uri: input.targetUri ?? "",
      limit: input.limit ?? 10,
      score_threshold: input.scoreThreshold
    });
  }

  async addResource(path: string): Promise<OpenVikingAddResourceResult> {
    return await this.request<OpenVikingAddResourceResult>("POST", "/api/v1/resources", {
      path
    });
  }

  async ls(uri: string): Promise<OpenVikingLsResult> {
    return await this.request<OpenVikingLsResult>(
      "GET",
      `/api/v1/fs/ls?${new URLSearchParams({ uri, output: "original" }).toString()}`
    );
  }

  async glob(pattern: string, uri: string): Promise<OpenVikingGlobResult> {
    return await this.request<OpenVikingGlobResult>("POST", "/api/v1/search/glob", {
      pattern,
      uri
    });
  }

  async read(uri: string): Promise<OpenVikingReadResult> {
    return await this.request<OpenVikingReadResult>(
      "GET",
      `/api/v1/content/read?${new URLSearchParams({ uri }).toString()}`
    );
  }

  async abstract(uri: string): Promise<OpenVikingAbstractResult> {
    return await this.request<OpenVikingAbstractResult>(
      "GET",
      `/api/v1/content/abstract?${new URLSearchParams({ uri }).toString()}`
    );
  }

  async overview(uri: string): Promise<OpenVikingOverviewResult> {
    return await this.request<OpenVikingOverviewResult>(
      "GET",
      `/api/v1/content/overview?${new URLSearchParams({ uri }).toString()}`
    );
  }

  async find(query: string, targetUri: string, limit: number = 10): Promise<OpenVikingFindResult> {
    return await this.request<OpenVikingFindResult>("POST", "/api/v1/search/find", {
      query,
      target_uri: targetUri,
      limit
    });
  }

  async waitProcessed(timeoutMs: number = 120_000): Promise<void> {
    await this.request("POST", "/api/v1/system/wait", {
      timeout: timeoutMs / 1_000
    });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const payload = await this.requestRaw<OpenVikingApiResponse<T>>(method, path, body);
    if (payload.status !== "ok") {
      throw new OpenVikingHttpError(
        payload.error?.message ?? `OpenViking request failed: ${path}`,
        200,
        payload.error?.code
      );
    }
    return payload.result as T;
  }

  private async requestRaw<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "X-API-Key": this.apiKey } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });

      const text = await response.text();
      const data = text ? (JSON.parse(text) as T) : ({} as T);

      if (!response.ok) {
        throw new OpenVikingHttpError(
          `OpenViking HTTP ${response.status}: ${text || response.statusText}`,
          response.status
        );
      }

      return data;
    } catch (error) {
      if (error instanceof OpenVikingHttpError) {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new OpenVikingHttpError(`OpenViking request timeout: ${method} ${path}`);
      }

      throw new OpenVikingHttpError(
        `OpenViking request failed: ${method} ${path}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
