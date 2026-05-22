/**
 * Error classifier — STORY-012
 *
 * Decides whether an error from an external dependency (Vertex AI, HTTP, network)
 * is "transient" (worth retrying) or "fatal" (retry would just waste budget).
 *
 * Transient list (AC3):
 *   - Node syscall codes: ECONNRESET, ETIMEDOUT, ECONNREFUSED
 *   - HTTP status codes: 429 (rate-limit), 503 (unavailable), 504 (gateway timeout)
 *
 * Anything else is fatal (400/401/404 from Vertex, missing client_id, validation
 * failures, etc) and fails the job immediately.
 */

export const TRANSIENT_ERROR_CODES: readonly string[] = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "EPIPE",
] as const;

export const TRANSIENT_HTTP_STATUS: readonly number[] = [429, 503, 504] as const;

export interface ClassifiableError {
  code?: string | number;
  status?: number;
  statusCode?: number;
  response?: { status?: number; statusCode?: number };
  message?: string;
}

const numericStatus = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/**
 * Returns true when the error matches any transient signature and is worth
 * retrying with backoff. Safe for unknown / null / non-Error inputs.
 */
export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const err = error as ClassifiableError;

  // Node syscall code (network layer).
  if (typeof err.code === "string" && TRANSIENT_ERROR_CODES.includes(err.code)) {
    return true;
  }

  const statusCandidates = [
    numericStatus(err.status),
    numericStatus(err.statusCode),
    numericStatus(err.response?.status),
    numericStatus(err.response?.statusCode),
  ];

  for (const status of statusCandidates) {
    if (status !== undefined && TRANSIENT_HTTP_STATUS.includes(status)) {
      return true;
    }
  }

  // Heuristic for Vertex/Google SDK errors that surface only as message strings.
  const message = String(err.message || "").toLowerCase();
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("rate limit") ||
    message.includes("rate-limit") ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("service unavailable") ||
    message.includes("temporarily unavailable") ||
    message.includes("econnreset") ||
    message.includes("etimedout")
  ) {
    return true;
  }

  return false;
}

/**
 * Exponential backoff: attempt 1 → 1s, attempt 2 → 4s, attempt 3 → 16s.
 * `attemptCount` here is 1-indexed (the attempt number that just *failed*).
 * AC3: backoff is computed only for transient errors.
 */
export function getBackoffMs(attemptCount: number): number {
  const safe = Math.max(1, Math.floor(attemptCount));
  return Math.pow(4, safe - 1) * 1000;
}

/**
 * Maximum number of attempts before giving up (AC3: 3 total attempts).
 */
export const MAX_JOB_ATTEMPTS = 3;

/**
 * Helper used by workers: returns true when we should still retry.
 */
export function shouldRetry(error: unknown, attemptCount: number): boolean {
  return attemptCount < MAX_JOB_ATTEMPTS && isTransientError(error);
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
