import path from "node:path";
import type { AppConfig } from "../../config";
import type { ICatalogSource } from "./catalog-source";
import { FileModelsSource } from "./file-models-source";
import { HttpModelsSource } from "./http-models-source";

export const createCatalogSource = (config: AppConfig): ICatalogSource => {
  const source = config.catalog.source;

  if (source.type === "file") {
    const location = path.isAbsolute(source.location)
      ? source.location
      : path.resolve(config.paths.projectRoot, source.location);
    return new FileModelsSource(location);
  }

  return new HttpModelsSource(source.location, source.timeoutMs);
};
