import { json } from "@remix-run/node";
import { type ActionFunction } from "@remix-run/server-runtime";

import { env } from "~/env/server";

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST" /* || env.NODE_ENV !== 'production'*/) {
    return json([], 404);
  }

  const body = await request.text();

  if (env.NODE_ENV !== "production") {
    console.log("[Event]", body);
    return json([], 204);
  }

  try {
    await fetch("https://plausible.io/api/event", {
      body,
      method: "POST",
    });
  } catch {
    // ignore
  }

  return json([], 204);
};
