import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

function formatMessage(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return arg.stack ?? arg.message;
      }
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

function sendToSentry(level: "info" | "warn" | "error", args: unknown[]) {
  try {
    const message = formatMessage(args);
    if (level === "info") Sentry.logger.info(message);
    else if (level === "warn") Sentry.logger.warn(message);
    else Sentry.logger.error(message);
  } catch {
    // Sentry not initialized (e.g. tests or early bootstrap)
  }
}

export const logger = {
  info(...args: unknown[]) {
    sendToSentry("info", args);
    if (isDev) {
      console.log(...args);
    }
  },
  warn(...args: unknown[]) {
    sendToSentry("warn", args);
    if (isDev) {
      console.warn(...args);
    }
  },
  error(...args: unknown[]) {
    sendToSentry("error", args);
    if (isDev) {
      console.error(...args);
    }
  },
};
