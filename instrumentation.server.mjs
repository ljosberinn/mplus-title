import { init } from "@sentry/remix";

init({
    dsn: "https://67f4965ee4cd8ad31bf353bccd94f378@o163592.ingest.us.sentry.io/4507560161116160",
    tracesSampleRate: 1,
    autoInstrumentRemix: true
})