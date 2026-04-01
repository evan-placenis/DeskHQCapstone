import * as Sentry from "@sentry/nextjs";

/**
 * Trigger.dev tasks run outside Next.js `instrumentation.ts`.
 * Initialize Sentry so `Sentry.logger` (via @/lib/logger) and console capture work in workers.
 */
const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: "https://fcc28dbda36ec20cdb00c8f70f1aaddc@o4511140869636096.ingest.us.sentry.io/4511140873371648",
  tracesSampleRate: 0,
  enableLogs: true,
  sendDefaultPii: true,
  integrations: [
    ...(isProd
      ? [
          Sentry.consoleLoggingIntegration({
            levels: ["log", "warn", "error"],
          }),
        ]
      : []),
  ],
});
