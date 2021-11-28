import "../styles/globals.css";
import type { NextComponentType, NextPageContext } from "next";
import type { NextRouter } from "next/dist/client/router";

export type AppRenderProps = {
  pageProps: Record<string, unknown>;
  err?: Error;
  Component: NextComponentType<
    NextPageContext,
    Record<string, unknown>,
    Record<string, unknown>
  >;
  router: NextRouter;
};

export default function MyApp({
  Component,
  pageProps,
}: AppRenderProps): JSX.Element {
  return <Component {...pageProps} />;
}
