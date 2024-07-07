import { type LinksFunction, type MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import stylesheet from "~/tailwind.css";

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: stylesheet },

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
  ];
};

const title = "Title Cutoff History & Estimation";

export function meta(): ReturnType<MetaFunction> {
  const url = "https://mplus-title.vercel.app/";
  const description =
    "Seasonal Mythic+ Title Score History & Estimation, updated hourly.";

  return [
    { name: "title", content: title },
    { name: "charset", content: "utf-8" },
    { name: "viewport", content: "width=device-width,initial-scale=1" },
    { name: "og:url", content: url },
    { name: "twitter:url", content: url },
    { name: "image:alt", content: title },
    { name: "og:type", content: "website" },
    { name: "og:title", content: title },
    { name: "og:image", content: `${url}logo.webp` },
    { name: "og:image:alt", content: title },
    { name: "og:description", content: description },
    { name: "twitter:description", content: description },
    { name: "twitter:creator", content: "@gerrit_alex" },
    { name: "twitter:title", content: title },
    { name: "twitter:image", content: `${url}logo.webp` },
    { name: "og:site_name", content: title },
    { name: "og:locale", content: "en_US" },
    { name: "twitter:image:alt", content: title },
    { name: "twitter:card", content: "summary" },
    { name: "description", content: description },
    { name: "name", content: title },
    { name: "author", content: "Gerrit Alex" },
    { name: "revisit-after", content: "7days" },
    { name: "distribution", content: "global" },
    { name: "msapplication-TileColor", content: "#da532c" },
    { name: "theme-color", content: "#ffffff" },
  ];
};

export default function App(): JSX.Element {
  return (
    <html
      lang="en"
      dir="auto"
      className="bg-gray-900 text-gray-200 antialiased"
    >
      <head>
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen">
        <div className="flex min-h-screen flex-col">
          <Outlet />
        </div>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
