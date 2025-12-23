import { type Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

// eslint-disable-next-line import/no-default-export
export default {
  ssr: true,
  presets: [vercelPreset()],
} satisfies Config;
