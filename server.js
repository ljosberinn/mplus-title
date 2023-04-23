import * as build from "@remix-run/dev/server-build";
import { createRequestHandler } from "@remix-run/vercel";

import { env } from "./app/env/server";

export default createRequestHandler({ build, mode: env.NODE_ENV });
