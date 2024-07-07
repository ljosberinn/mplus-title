import { RemixBrowser } from "@remix-run/react";
import { useLocation, useMatches } from "@remix-run/react";
import { browserTracingIntegration, init, replayIntegration } from "@sentry/remix";
import { startTransition, StrictMode, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";

init({
  dsn: "https://67f4965ee4cd8ad31bf353bccd94f378@o163592.ingest.us.sentry.io/4507560161116160",
  tracesSampleRate: 1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,

  integrations: [browserTracingIntegration({
    useEffect,
    useLocation,
    useMatches
  }), replayIntegration()]
})

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
