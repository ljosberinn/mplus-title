import { Html, Head, Main, NextScript } from "next/document";

export default function CustomDocument(/* props: DocumentProps*/): JSX.Element {
  return (
    <Html dir="auto" lang="en" className="antialiased">
      <Head>
        <meta content="global" name="distribution" />
        <meta content="7 days" name="revisit-after" />
        <meta content="Gerrit Alex" name="author" />
      </Head>
      <body className="bg-gray-900 text-gray-200">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
