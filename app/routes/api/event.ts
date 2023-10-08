import { json } from "@remix-run/node";
import { type ActionFunction } from "@remix-run/server-runtime";

import { env } from "~/env/server";

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST" || env.NODE_ENV !== 'production') {
    return json([], 404);
  }

  try {
    const body = await request.text();

    await fetch("https://plausible.io/api/event", {
      body,
      method: 'POST'
    });
  } catch {
    // ignore
  }

  return json([], 204);
};
