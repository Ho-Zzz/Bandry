export type ResourceCenterErrorCode =
  | "STORE_READ_FAILED"
  | "STORE_WRITE_FAILED"
  | "ARTIFACT_NOT_FOUND"
  | "ARTIFACT_COPY_FAILED"
  | "MANIFEST_CORRUPTED"
  | "CURATION_FAILED";

export class ResourceCenterError extends Error {
  readonly code: ResourceCenterErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: ResourceCenterErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ResourceCenterError";
    this.code = code;
    this.details = details;
  }
}
