/**
 * Structured logger (pino) — STORY-012
 *
 * Singleton instance shared across the backend. In development emits pretty
 * colored output via pino-pretty; in production emits JSON to stdout so the
 * platform (PM2/Nginx/journald) can capture and aggregate it.
 *
 * Usage:
 *   import logger from "../utils/logger";
 *   logger.info({ event: "job_started", job_id }, "Calendar job started");
 *
 *   // child loggers carry context across nested calls
 *   const log = logger.child({ job_id, job_type: "calendar" });
 *   log.error({ event: "job_failed", error_message }, "Falha no worker");
 */

import pino, { Logger } from "pino";

const isProduction = process.env.NODE_ENV === "production";
const logLevel = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

const logger: Logger = pino({
  level: logLevel,
  // Standardize timestamp to ISO 8601 (AC2 requirement).
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  // Make level a string ("info") instead of numeric for easier log parsing.
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  // Never log raw Authorization headers or secrets.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.headers.cookie',
      "*.password",
      "*.token",
      "*.apiKey",
      "*.api_key",
      "GOOGLE_API_KEY",
      "JWT_SECRET",
    ],
    censor: "[REDACTED]",
  },
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

export default logger;
export { logger };
