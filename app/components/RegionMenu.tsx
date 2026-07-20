import { type ReactNode } from "react";
import { Link, useNavigation, useSearchParams } from "react-router";

import { type EnhancedSeason } from "~/seasons";
import { orderedRegionsBySize, regionsToPathSegment } from "~/utils";

import { linkClassName } from "./tokens";

type RegionToggleProps = {
  season: EnhancedSeason;
};

export function RegionToggle({ season }: RegionToggleProps): ReactNode {
  const [searchParams] = useSearchParams();
  const { state: navigationState } = useNavigation();

  const [currentRegion] = season.score.regionsToDisplay;
  const query = searchParams.toString();
  const suffix = query ? `?${query}` : "";

  const base = linkClassName.replace("py-1", "").replace("px-2", "");

  return (
    <fieldset disabled={navigationState !== "idle"}>
      <ul className="flex flex-col space-y-2 md:flex-row md:space-x-2 md:space-y-0">
        {orderedRegionsBySize.map((region) => {
          const active = region === currentRegion;

          return (
            <li
              key={region}
              className={`rounded-md ${
                active || navigationState !== "idle"
                  ? base
                      .replace("bg-gray-700", "bg-gray-800")
                      .replace(
                        "hover:bg-gray-500",
                        `${
                          active ? "cursor-default" : "cursor-wait"
                        } grayscale`,
                      )
                  : base
              }`}
            >
              <Link
                to={`/${season.slug}/${regionsToPathSegment([region])}${suffix}`}
                replace
                aria-current={active ? "page" : undefined}
                className={`${active ? "cursor-default" : "cursor-pointer"} flex items-center gap-2 px-2 py-1`}
              >
                {region.toUpperCase()}
              </Link>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
