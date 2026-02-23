import fs from "node:fs/promises";
import type { ICatalogSource, CatalogSourceFetchResult } from "./catalog-source";

export class FileModelsSource implements ICatalogSource {
  constructor(private readonly location: string) {}

  async fetch(): Promise<CatalogSourceFetchResult> {
    const text = await fs.readFile(this.location, "utf8");
    const payload = JSON.parse(text) as unknown;

    return {
      sourceType: "file",
      sourceLocation: this.location,
      fetchedAt: Date.now(),
      payload
    };
  }
}
