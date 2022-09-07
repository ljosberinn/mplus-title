import type { MetaFunction, LinksFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  NavLink,
  useParams,
  Link,
} from "@remix-run/react";

import { seasonStartDates, latestSeason, orderedRegionsBySize } from "./meta";
import styles from "./styles/app.css";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};

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
  return (
    <html lang="en" dir="auto" className="antialiased">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="text-gray-200 bg-gray-900">
        <main className="max-w-7xl m-auto">
          <h1 className="pt-8 pb-2 text-2xl text-center text-semibold">
            {title}
          </h1>

          <p className="pb-4 italic text-center">updates hourly</p>
          <p className="pb-4 italic text-center">
            extrapolation ignores the first two weeks of a season. apart from
            that its linear, as it cannot guess ever-moving variables such as
            participation, better/worse weeks etc.
          </p>

          <Nav />
          <Outlet />
          <ScrollRestoration />
          <Scripts />
          <LiveReload />
          <Footer />
        </main>
      </body>
    </html>
  );
}

const linkClassName =
  "px-2 py-1 text-white transition-all duration-200 ease-in-out rounded-lg outline-none bg-gray-700 hover:bg-gray-500 focus:outline-none focus:ring-2 focus-ring-gray:500";
const activeLinkClassName = "underline bg-gray-500";

function navLinkClassNameActivity({ isActive }: { isActive: boolean }) {
  return isActive ? `${linkClassName} ${activeLinkClassName}` : linkClassName;
}

function Nav() {
  const params = useParams();

  return (
    <nav className="flex flex-col justify-between w-full md:flex-row md:px-4">
      <ul className="flex px-4 pt-4 space-x-2 md:pt-0 md:px-0">
        {Object.keys(seasonStartDates)
          .filter((key) => Date.now() >= seasonStartDates[key].us)
          .map((season) => {
            const seasonName = season === latestSeason ? "latest" : season;
            const path = [seasonName, params.region, params.faction]
              .filter(Boolean)
              .join("/");

            return (
              <li key={season}>
                <NavLink className={navLinkClassNameActivity} to={path}>
                  {seasonName}
                </NavLink>
              </li>
            );
          })}
      </ul>

      {params.season ? (
        <ul className="flex px-4 pt-4 space-x-2 md:pt-0 md:px-0">
          {params.region ? (
            <li>
              <Link className={linkClassName} to={`${params.season}`}>
                all
              </Link>
            </li>
          ) : null}
          {orderedRegionsBySize.map((region) => {
            const path = [params.season, region].filter(Boolean).join("/");

            return (
              <li key={region}>
                <NavLink className={navLinkClassNameActivity} to={path}>
                  {region.toUpperCase()}
                </NavLink>
              </li>
            );
          })}
        </ul>
      ) : null}
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
