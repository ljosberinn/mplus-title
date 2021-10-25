import "../styles/globals.css";
import { NextComponentType, NextPageContext } from "next";
import { NextRouter } from "next/dist/client/router";
import Head from "next/head";

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
  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
        <title>Mythic+ Estimated Title Cutoff</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
