import type { CatalogSourceType } from "../../config";

export type CatalogSourceFetchResult = {
  sourceType: CatalogSourceType;
  sourceLocation: string;
  fetchedAt: number;
  payload: unknown;
};

export interface ICatalogSource {
  fetch(): Promise<CatalogSourceFetchResult>;
}
