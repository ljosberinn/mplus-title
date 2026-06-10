import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import ReactCompilerPlugin from "babel-plugin-react-compiler";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    reactRouter(),
    babel({
      include: [/\/app\/.*\.[jt]sx?$/u],
      babelConfig: {
        plugins: [
          [
            "@babel/plugin-syntax-typescript",
            { isTSX: true, allExtensions: true },
          ],
          ReactCompilerPlugin,
        ],
      },
    }),
  ],
});
