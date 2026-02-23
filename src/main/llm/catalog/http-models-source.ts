import type { ICatalogSource, CatalogSourceFetchResult } from "./catalog-source";

export class HttpModelsSource implements ICatalogSource {
  constructor(
    private readonly location: string,
    private readonly timeoutMs: number
  ) {}

  async fetch(): Promise<CatalogSourceFetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(this.location, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`catalog source responded with status ${response.status}`);
      }

      const payload = await response.json();
      return {
        sourceType: "http",
        sourceLocation: this.location,
        fetchedAt: Date.now(),
        payload
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
