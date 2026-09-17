type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };

export class WCARequestQueue {
  private tail: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;
  private blockedUntil = 0;

  constructor(
    private readonly intervalMs = 2000,
    private readonly clock: Clock = {
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    }
  ) {}

  defer(ms: number) {
    this.blockedUntil = Math.max(this.blockedUntil, this.clock.now() + ms);
  }

  run<T>(request: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      let delay: number;
      while ((delay = Math.max(this.nextRequestAt, this.blockedUntil) - this.clock.now()) > 0) {
        await this.clock.sleep(delay);
      }
      this.nextRequestAt = this.clock.now() + this.intervalMs;
      return request();
    });
    // A failed request must not poison the queue for subsequent callers.
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

export function getWCARateLimitDelay(response: Response, attempt: number, now = Date.now()) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now;
    if (Number.isFinite(delay) && delay >= 0) return Math.max(2000, delay);
  }
  return Math.min(120_000, 30_000 * 2 ** attempt);
}
