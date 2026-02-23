import type { AppConfig } from "../../config";

const withTimeout = async <T>(
  timeoutMs: number,
  task: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

export const runWebSearch = async (config: AppConfig, query: string): Promise<string> => {
  if (!config.tools.webSearch.enabled) {
    throw new Error("web_search is disabled in settings");
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("web_search requires non-empty query");
  }

  const baseUrl = config.tools.webSearch.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/search`;
  const apiKey = config.tools.webSearch.apiKey.trim();
  if (!apiKey) {
    throw new Error("Tavily API key is missing");
  }

  const response = await withTimeout(config.tools.webSearch.timeoutMs, async (signal) => {
    return await fetch(endpoint, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: trimmedQuery,
        max_results: config.tools.webSearch.maxResults
      })
    });
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`web_search request failed (${response.status}): ${text || response.statusText}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
    }>;
  };

  const results = payload.results ?? [];
  if (results.length === 0) {
    return "No web_search results.";
  }

  return results
    .slice(0, config.tools.webSearch.maxResults)
    .map((item, index) => {
      const title = item.title?.trim() || "Untitled";
      const url = item.url?.trim() || "";
      const score = typeof item.score === "number" ? ` score=${item.score.toFixed(3)}` : "";
      const snippet = (item.content ?? "").replace(/\s+/g, " ").trim().slice(0, 320);
      return `${index + 1}. ${title}${score}\n${url}\n${snippet}`;
    })
    .join("\n\n");
};

const toJinaFetchUrl = (baseUrl: string, targetUrl: string): string => {
  const normalizedBase = baseUrl.trim() || "https://r.jina.ai/http://";
  const cleanedBase = normalizedBase.endsWith("/") ? normalizedBase : `${normalizedBase}/`;
  if (cleanedBase.includes("{url}")) {
    return cleanedBase.replace("{url}", encodeURIComponent(targetUrl));
  }

  const stripped = targetUrl.replace(/^https?:\/\//i, "");
  return `${cleanedBase}${stripped}`;
};

export const runWebFetch = async (config: AppConfig, url: string): Promise<string> => {
  if (!config.tools.webFetch.enabled) {
    throw new Error("web_fetch is disabled in settings");
  }

  const targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    throw new Error("web_fetch requires an absolute http/https url");
  }

  const endpoint = toJinaFetchUrl(config.tools.webFetch.baseUrl, targetUrl);
  const apiKey = config.tools.webFetch.apiKey.trim();

  const response = await withTimeout(config.tools.webFetch.timeoutMs, async (signal) => {
    return await fetch(endpoint, {
      method: "GET",
      signal,
      headers: apiKey
        ? {
            Authorization: `Bearer ${apiKey}`
          }
        : undefined
    });
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`web_fetch request failed (${response.status}): ${text || response.statusText}`);
  }

  const text = await response.text();
  return text.slice(0, 8_000);
};
