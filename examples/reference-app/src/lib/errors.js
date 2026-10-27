// @ts-check
/**
 * One error type for expected failures, one envelope for every error response.
 * Unexpected errors become a generic 500 — internals never reach the client.
 */

/** @typedef {{ field: string, reason: string }} ErrorDetail */

export class AppError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code stable machine-readable code
   * @param {string} message safe, user-facing message
   * @param {{ details?: ErrorDetail[], headers?: Record<string, string> }} [extra]
   */
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = extra.details;
    this.headers = extra.headers;
  }
}

/** @param {ErrorDetail[]} details */
export const validationError = (details) => new AppError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { details });
export const badRequest = (message = "The request could not be understood.") => new AppError(400, "BAD_REQUEST", message);
export const unauthenticated = () => new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
export const forbidden = (message = "You do not have permission to do that.") => new AppError(403, "FORBIDDEN", message);
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found.`);
/** @param {string} message @param {ErrorDetail[]} [details] */
export const conflict = (message, details) => new AppError(409, "CONFLICT", message, { details });
export const payloadTooLarge = () => new AppError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
export const unsupportedMediaType = () => new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON with Content-Type: application/json.");
/** @param {number} retryAfterSeconds */
export const tooManyRequests = (retryAfterSeconds) =>
  new AppError(429, "RATE_LIMITED", "Too many requests. Please wait and try again.", { headers: { "Retry-After": String(retryAfterSeconds) } });

/**
 * @param {unknown} err
 * @param {string} requestId
 * @returns {{ status: number, headers: Record<string, string>, body: object, unexpected: boolean }}
 */
export function toErrorResponse(err, requestId) {
  if (err instanceof AppError) {
    return {
      status: err.status,
      headers: err.headers ?? {},
      body: { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}), requestId } },
      unexpected: false,
    };
  }
  return {
    status: 500,
    headers: {},
    body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again.", requestId } },
    unexpected: true,
  };
}
