import { useRouteLoaderData } from "@remix-run/react";
import { lazy, Suspense } from "react";

import  { type EnhancedSeason } from "~/seasons";

import { Logo } from "./Logo";
import { BuyMeACoffee, RaiderPatreon, Twitter, WCLPatreon } from "./NavLink";
import { SeasonMenu } from "./SeasonMenu";

const RegionToggle = lazy(() => import("./RegionMenu"));
const OverlaysToggle = lazy(() => import("./OverlaysToggle"));
const CustomExtrapolationForm = lazy(() => import("./CustomExtrapolationForm"));

export function Header(): JSX.Element {
  const season = useRouteLoaderData("routes/season/$season") as EnhancedSeason|null;

  let seasonHasStarted = false;
  let seasonHasEndedInEveryRegion = false;

  if (season) {
    seasonHasStarted = Object.values(season.startDates).some(
      (maybeDate) => maybeDate !== null && maybeDate <= Date.now(),
    );

    seasonHasEndedInEveryRegion = Object.values(season.endDates).every(
      (maybeDate) => maybeDate !== null && maybeDate <= Date.now(),
    );
  }

  return (
    <>
      <header className="flex h-20 items-center justify-between border-b  border-gray-700 p-6 text-stone-100 drop-shadow-sm print:hidden">
        <nav className="mx-auto flex w-full max-w-screen-2xl items-center justify-between">
          <ul>
            <li>
              <Logo />
            </li>
          </ul>
          <ul className="hidden space-x-2 lg:flex">
            <BuyMeACoffee />
            <RaiderPatreon />
            <WCLPatreon />
            <Twitter />
          </ul>
          <SeasonMenu />
        </nav>
      </header>
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between">
        <div className="flex w-full flex-col flex-wrap justify-between gap-3 pt-4 md:flex-row md:px-4">
          {season ? (
            <Suspense>
              <RegionToggle season={season} />
              <OverlaysToggle season={season} />
            </Suspense>
          ) : null}
        </div>
      </div>

      <Suspense>
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between">
          <div className="flex w-full flex-col flex-wrap justify-between gap-3 md:flex-row">
            {season && seasonHasStarted && !seasonHasEndedInEveryRegion ? (
              <CustomExtrapolationForm season={season} />
            ) : null}
          </div>
        </div>
      </Suspense>
    </>
  );
}
