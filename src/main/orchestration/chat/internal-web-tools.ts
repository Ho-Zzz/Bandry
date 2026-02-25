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

/**
 * Search GitHub repositories using the GitHub Search API.
 * This is more reliable than web_fetch for GitHub searches because
 * GitHub search pages require JavaScript rendering.
 */
export const runGitHubSearch = async (
  config: AppConfig,
  query: string,
  type: "repositories" | "code" | "issues" = "repositories"
): Promise<string> => {
  if (!config.tools.githubSearch.enabled) {
    throw new Error("github_search is disabled in settings");
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("github_search requires non-empty query");
  }

  const baseUrl = config.tools.githubSearch.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/search/${type}?q=${encodeURIComponent(trimmedQuery)}&per_page=${config.tools.githubSearch.maxResults}`;
  const apiKey = config.tools.githubSearch.apiKey.trim();

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Bandry-Agent/1.0"
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await withTimeout(config.tools.githubSearch.timeoutMs, async (signal) => {
    return await fetch(endpoint, {
      method: "GET",
      signal,
      headers
    });
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`github_search request failed (${response.status}): ${text || response.statusText}`);
  }

  if (type === "repositories") {
    const payload = (await response.json()) as {
      total_count?: number;
      items?: Array<{
        full_name?: string;
        html_url?: string;
        description?: string;
        stargazers_count?: number;
        language?: string;
        updated_at?: string;
      }>;
    };

    const items = payload.items ?? [];
    if (items.length === 0) {
      return `No repositories found for query: "${trimmedQuery}"`;
    }

    const results = items.map((item, index) => {
      const name = item.full_name ?? "Unknown";
      const url = item.html_url ?? "";
      const desc = item.description?.slice(0, 200) ?? "No description";
      const stars = item.stargazers_count ?? 0;
      const lang = item.language ?? "Unknown";
      return `${index + 1}. ${name} (${stars} stars, ${lang})\n   ${url}\n   ${desc}`;
    });

    return `Found ${payload.total_count ?? items.length} repositories:\n\n${results.join("\n\n")}`;
  }

  // For code/issues, return raw JSON for now
  const payload = await response.json();
  return JSON.stringify(payload, null, 2).slice(0, 4000);
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
