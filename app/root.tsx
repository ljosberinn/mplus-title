import type {
  MetaFunction,
  LinksFunction,
  SerializeFrom,
} from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  NavLink,
  useLoaderData,
  useNavigation,
  useNavigate,
} from "@remix-run/react";

import { seasons } from "./seasons";
import stylesheet from "~/tailwind.css";
import { Analytics } from "@vercel/analytics/react";
import { MouseEvent } from "react";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesheet }];
};

export const loader = () => {
  return {
    ENV: {
      VERCEL_ANALYTICS_ID: process.env.VERCEL_ANALYTICS_ID,
    },
  };
};

declare global {
  interface Window {
    ENV: SerializeFrom<typeof loader>["ENV"];
  }
}

const title = "Mythic+ Estimated Title Cutoff";

export const meta: MetaFunction = () => {
  const url = "https://mplus-title.vercel.app/";
  const description =
    "Displays estimated rank & score required for the seasonal Mythic+ title.";

  return {
    charset: "utf-8",
    title,
    viewport: "width=device-width,initial-scale=1",
    "og:url": url,
    "twitter:url": url,
    "image:alt": title,
    "og:type": "website",
    "og:title": title,
    "og:image:alt": title,
    "og:description": description,
    "twitter:description": description,
    "twitter:creator": "@gerrit_alex",
    "twitter:title": title,
    "og:site_name": title,
    "og:locale": "en_US",
    "twitter:image:alt": title,
    "twitter:card": "summary",
    description,
    name: title,
    author: "Gerrit Alex",
    "revisit-after": "7days",
    distribution: "global",
  };
};

export default function App(): JSX.Element {
  const { ENV } = useLoaderData<typeof loader>();

  return (
    <html lang="en" dir="auto" className="antialiased">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="bg-gray-900 text-gray-200">
        <main className="m-auto max-w-7xl">
          <h1 className="text-semibold pt-8 pb-2 text-center text-2xl">
            {title}
          </h1>

          <p className="pb-4 text-center italic">updates hourly</p>
          <p className="pb-4 text-center italic">
            extrapolation ignores the first FOUR weeks of a season. further
            weeks are weighted relatively to today
          </p>

          <Nav />
          <Outlet />
          <ScrollRestoration />
          <Analytics />
          <Scripts />
          <LiveReload />
          <Footer />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.ENV = ${JSON.stringify(ENV)}`,
            }}
          />
        </main>
      </body>
    </html>
  );
}

const linkClassName =
  "flex space-x-2 px-2 py-1 text-white transition-all duration-200 ease-in-out rounded-lg outline-none bg-gray-700 hover:bg-gray-500 focus:outline-none focus:ring-2 focus-ring-gray:500";
const activeLinkClassName = "underline bg-gray-500";

function navLinkClassNameActivity({ isActive }: { isActive: boolean }) {
  return isActive ? `${linkClassName} ${activeLinkClassName}` : linkClassName;
}

function Nav() {
  const now = Date.now();
  const navigation = useNavigation();

  return (
    <nav className="flex w-full flex-col justify-between md:flex-row md:px-4">
      <ul className="flex flex-col space-y-2 px-4 pt-4 md:flex-row md:space-x-2 md:space-y-0 md:px-0 md:pt-0">
        {seasons.map((season) => {
          const body = (
            <>
              <img
                src={season.seasonIcon}
                alt=""
                loading="lazy"
                height="24"
                width="24"
                className="h-6 w-6"
              />
              <span>{season.name}</span>
            </>
          );

          return (
            <li key={season.slug}>
              {season.startDates.us &&
              now >= season.startDates.us &&
              navigation.state === "idle" ? (
                <NavLink className={navLinkClassNameActivity} to={season.slug}>
                  {body}
                </NavLink>
              ) : (
                <span
                  className={linkClassName
                    .replace("bg-gray-700", "bg-gray-800")
                    .replace(
                      "hover:bg-gray-500",
                      `${
                        navigation.state !== "idle"
                          ? "cursor-wait"
                          : "cursor-not-allowed"
                      } grayscale`
                    )}
                >
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mb-6">
      <nav>
        <ul className="flex justify-center space-x-2">
          <li>
            <a
              href="https://github.com/ljosberinn/mplus-title"
              rel="noopener noreferrer"
              className="underline"
              target="_blank"
            >
              repo
            </a>
          </li>
          <li>
            <a
              href="https://twitter.com/gerrit_alex"
              rel="noopener noreferrer"
              className="underline"
              target="_blank"
            >
              twitter
            </a>
          </li>
          <li>
            <a
              href="https://raider.io/characters/eu/twisting-nether/Xepheris"
              rel="noopener noreferrer"
              className="underline"
              target="_blank"
            >
              rio
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
