export const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

export class RateLimiter {
  private nextAvailableAt = 0;
  private readonly intervalMs: number;

  constructor(ratePerSecond: number) {
    this.intervalMs = ratePerSecond > 0 ? Math.round(1000 / ratePerSecond) : 0;
  }

  async waitTurn(): Promise<void> {
    if (this.intervalMs <= 0) {
      return;
    }

    const now = Date.now();
    const waitMs = Math.max(0, this.nextAvailableAt - now);
    this.nextAvailableAt = Math.max(this.nextAvailableAt, now) + this.intervalMs;

    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }
}
