export class ModelRequestError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; retryable: boolean }) {
    super(message);
    this.name = "ModelRequestError";
    this.status = options.status;
    this.retryable = options.retryable;
  }
}
