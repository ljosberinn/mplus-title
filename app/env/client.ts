import { z } from "zod";

/**
 * Client accessible variables go here.
 */
export const clientSchema = z.object({
  VERCEL_ANALYTICS_ID: z.string().optional(),
});

/**
 * Can't destruct `process.env` on client-side, so destruct here instead.
 */
export const clientProcessEnv = {
  VERCEL_ANALYTICS_ID: process.env.VERCEL_ANALYTICS_ID,
};

const parsed = clientSchema.safeParse(clientProcessEnv);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
