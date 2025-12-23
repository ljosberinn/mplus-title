import {
  isRouteErrorResponse,
  Links,
  type LinksFunction,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";

import "./app.css";

export const links: Route.LinksFunction = () => {
  return [
    {
      rel: "apple-touch-icon",
      sizes: "180x180",
      href: "/apple-touch-icon.png",
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      href: "/favicon-32x32.png",
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      href: "/favicon-16x16.png",
    },
    {
      rel: "icon",
      type: "image/x-icon",
      href: "/favicon.ico",
    },
    { rel: "manifest", href: "/site.webmanifest" },
    {
      rel: "mask-icon",
      href: "/safari-pinned-tab.svg",
      color: "#5bbad5",
    },
  ] satisfies ReturnType<LinksFunction>;
};

export default function App(): JSX.Element {
  const title = "Title Cutoff History & Estimation";
  const url = "https://mplus-title.vercel.app/";
  const description =
    "Seasonal Mythic+ Title Score History & Estimation, updated hourly.";

  return (
    <html
      lang="en"
      dir="auto"
      className="bg-gray-900 text-gray-200 antialiased"
    >
      <head>
        <title>{title}</title>
        <meta name="charset" content="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="og:url" content="https://mplus-title.vercel.app/" />
        <meta name="twitter:url" content="https://mplus-title.vercel.app/" />
        <meta name="image:alt" content={title} />
        <meta name="og:type" content="website" />
        <meta name="og:title" content={title} />
        <meta name="og:image" content={`${url}/logo.webp`} />
        <meta name="og:image:alt" content={title} />
        <meta name="og:description" content={description} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:creator" content="@xepher1s" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:image" content={`${url}/logo.webp`} />
        <meta name="og:site_name" content={title} />
        <meta name="og:locale" content="en_US" />
        <meta name="twitter:image:alt" content={title} />
        <meta name="twitter:card" content="summary" />
        <meta name="description" content={description} />
        <meta name="name" content={title} />
        <meta name="revisit-after" content="7days" />
        <meta name="distribution" content="global" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
        <Links />
      </head>
      <body className="min-h-screen">
        <div className="flex min-h-screen flex-col">
          <Outlet />
        </div>
        <ScrollRestoration />
        <Scripts />

        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
        window.counterscale = {
            q: [["set", "siteId", "mplus-title"], ["trackPageview"]],
        };
    })();`,
          }}
        />
        <script
          id="counterscale-script"
          defer
          src="https://counterscale.gerritalex.workers.dev/tracker.js"
        />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
