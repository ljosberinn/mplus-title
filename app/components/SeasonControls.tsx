/**
 * The per-season controls — region selection, the Configure menu and the custom
 * extrapolation form. Rendered at the top of <main> (inside the framed content
 * column) rather than in the header, so they align with the charts.
 */
import { lazy, type ReactNode, Suspense } from "react";
import { ClientOnly } from "remix-utils/client-only";

import { type EnhancedSeason } from "~/seasons";

import { ConfigureMenu } from "./ConfigureMenu";
import { RegionToggle } from "./RegionMenu";

const CustomExtrapolationForm = lazy(
  () => import("./CustomExtrapolationForm.client"),
);

type SeasonControlsProps = {
  season: EnhancedSeason;
};

export function SeasonControls({ season }: SeasonControlsProps): ReactNode {
  const seasonHasStarted = Object.values(season.startDates).some(
    (maybeDate) => maybeDate !== null && maybeDate <= Date.now(),
  );

  const seasonHasEndedInEveryRegion = Object.values(season.endDates).every(
    (maybeDate) => maybeDate !== null && maybeDate <= Date.now(),
  );

  return (
    <>
      <div className="flex w-full flex-col flex-wrap justify-between gap-3 md:flex-row">
        <RegionToggle season={season} />
        <ConfigureMenu season={season} />
      </div>
      {seasonHasStarted && !seasonHasEndedInEveryRegion ? (
        <ClientOnly>
          {() => (
            <Suspense fallback={null}>
              <div className="flex w-full flex-col flex-wrap justify-between gap-3 md:flex-row">
                <CustomExtrapolationForm season={season} />
              </div>
            </Suspense>
          )}
        </ClientOnly>
      ) : null}
    </>
  );
}
