import { Html, Head, Main, NextScript } from "next/document";

export default function CustomDocument(/* props: DocumentProps*/): JSX.Element {
  return (
    <Html dir="auto" lang="en" className="antialiased">
      <Head>
        <meta content="global" name="distribution" />
        <meta content="7 days" name="revisit-after" />
        <meta content="Gerrit Alex" name="author" />

        <meta itemProp="name" content="Mythic+ Estimated Title Cutoff" />
        <meta
          itemProp="description"
          content="Displays estimated rank & score required for the seasonal Mythic+ title."
        />
        <meta
          property="image:alt"
          content="Mythic+ Estimated Title Cutoff mascot Froggy"
        />

        <meta property="og:url" content="https://mplus-title.vercel.app/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Mythic+ Estimated Title Cutoff" />
        <meta
          property="og:image:alt"
          content="Mythic+ Estimated Title Cutoff"
        />
        <meta
          property="og:description"
          content="Displays estimated rank & score required for the seasonal Mythic+ title."
        />
        <meta
          property="og:site_name"
          content="Mythic+ Estimated Title Cutoff"
        />
        <meta property="og:locale" content="en_US" />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:creator" content="@gerrit_alex" />
        <meta name="twitter:url" content="https://mplus-title.vercel.app/" />
        <meta name="twitter:title" content="Mythic+ Estimated Title Cutoff" />
        <meta
          name="twitter:description"
          content="Displays estimated rank & score required for the seasonal Mythic+ title."
        />
        <meta
          name="twitter:image:alt"
          content="Mythic+ Estimated Title Cutoff"
        />
      </Head>
      <body className="text-gray-200 bg-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
