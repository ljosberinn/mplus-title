import { lazy, Suspense } from "react";

import { type EnhancedSeason } from "~/seasons";

import { Logo } from "./Logo";
import { BuyMeACoffee, RaiderPatreon, Twitter, WCLPatreon } from "./NavLink";
import { OverlaysToggle } from "./OverlaysToggle";
import { RegionToggle } from "./RegionMenu";
import { SeasonMenu } from "./SeasonMenu";

type HeaderProps = {
  season: EnhancedSeason;
};

const CustomExtrapolationForm = lazy(() => import("./CustomExtrapolationForm.client"));

export function Header({ season }: HeaderProps): JSX.Element {
  const seasonHasStarted = Object.values(season.startDates).some(
    (maybeDate) => maybeDate !== null && maybeDate <= Date.now(),
  );

  const seasonHasEndedInEveryRegion = Object.values(season.endDates).every(
    (maybeDate) => maybeDate !== null && maybeDate <= Date.now(),
  );

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
          <RegionToggle season={season} />
          <OverlaysToggle season={season} />
        </div>
      </div>
      {seasonHasStarted && !seasonHasEndedInEveryRegion ? (
        <Suspense fallback={null}>
          <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between">
            <div className="flex w-full flex-col flex-wrap justify-between gap-3 md:flex-row">
              <CustomExtrapolationForm season={season} />
            </div>
          </div>
        </Suspense>
      ) : null}
    </>
  );
}
