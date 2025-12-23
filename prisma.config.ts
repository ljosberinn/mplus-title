import "dotenv/config";

import { defineConfig, env } from "prisma/config";

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
  schema: "prisma/schema.prisma",
});
