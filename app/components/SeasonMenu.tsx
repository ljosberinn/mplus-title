/**
 * Season switcher: a lightweight grouped dropdown keyed on the season
 * `expansion` field. SSR-safe — a controlled `<details>`-style
 * popover with click-outside + Escape handling, no client-only gate. Carries the
 * current region path segment and the `?params` passthrough across a season
 * switch, keeps the disabled/selected logic, and adds `prefetch="intent"` so
 * hovering a season warms its loader.
 */
import clsx from "clsx";
import { type ReactNode, useRef, useState } from "react";
import {
  NavLink,
  useNavigation,
  useParams,
  useSearchParams,
} from "react-router";
import { ClientOnly } from "remix-utils/client-only";

import { type Expansion, type Season, seasons } from "~/seasons";

import { useDismiss } from "./useDismiss";

/** Heading shown per group; matches the previous uppercased slug-prefix. */
const expansionLabel = (expansion: Expansion): string =>
  expansion.toUpperCase();

type SeasonGroup = { expansion: Expansion; seasons: Season[] };

/** Group consecutive seasons by expansion, preserving the source order. */
function groupByExpansion(list: Season[]): SeasonGroup[] {
  const groups: SeasonGroup[] = [];

  for (const season of list) {
    const last = groups.at(-1);

    if (last?.expansion === season.expansion) {
      last.seasons.push(season);
    } else {
      groups.push({ expansion: season.expansion, seasons: [season] });
    }
  }

  return groups;
}

export function SeasonMenu(): ReactNode {
  const now = Date.now();
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const { season: selectedSeasonSlug, regions: regionSegment } = useParams();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const paramsAsString = params.toString() ? `?${params.toString()}` : "";

  const selectedSeason = seasons.find(
    (season) => season.slug === selectedSeasonSlug,
  );

  // close on outside click / Escape while open (shared with the Features modal).
  useDismiss(open, containerRef, () => {
    setOpen(false);
  });

  const groups = groupByExpansion(seasons);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className="cursor-pointer flex space-x-2 border border-gray-600 bg-gray-700 px-4 py-2 font-medium text-white outline-none ring-gray-500 transition-all duration-200 ease-in-out hover:bg-gray-500 focus:outline-none focus:ring-2"
      >
        {selectedSeason ? (
          <SeasonNavItemBody season={selectedSeason} />
        ) : (
          <span>Seasons</span>
        )}
        <span
          aria-hidden="true"
          className={clsx("pl-1 transition-all", open && "rotate-180")}
        >
          <ClientOnly fallback={<>v</>}>{() => <>▼</>}</ClientOnly>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-56 overflow-hidden border border-gray-600 bg-gray-700 shadow-lg"
        >
          {groups.map((group) => {
            return (
              <div key={group.expansion}>
                <span className="inline-block w-full bg-gray-600 px-4 py-1 text-lg font-semibold text-white">
                  {expansionLabel(group.expansion)}
                </span>
                <ul className="m-0 list-none p-0">
                  {group.seasons.map((season) => {
                    const isSelected = selectedSeason?.slug === season.slug;
                    const disabled =
                      isSelected ||
                      season.startDates.US === null ||
                      season.startDates.US > now ||
                      navigation.state !== "idle";

                    return (
                      <li key={season.slug}>
                        {disabled ? (
                          <span
                            className={clsx(
                              "flex flex-1 items-center space-x-2 bg-gray-800 px-4 py-2 text-white outline-none grayscale transition-all duration-200 ease-in-out",
                              navigation.state === "idle"
                                ? "cursor-not-allowed"
                                : "cursor-wait",
                            )}
                          >
                            <SeasonNavItemBody season={season} />
                          </span>
                        ) : (
                          <NavLink
                            role="menuitem"
                            prefetch="intent"
                            to={`/${season.slug}${regionSegment ? `/${regionSegment}` : ""}${paramsAsString}`}
                            onClick={() => {
                              setOpen(false);
                            }}
                            className="flex flex-1 items-center space-x-2 bg-gray-700 px-4 py-2 text-white outline-none transition-all duration-200 ease-in-out hover:bg-gray-500"
                          >
                            <SeasonNavItemBody season={season} />
                          </NavLink>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeasonNavItemBody({ season }: { season: Season }): ReactNode {
  return (
    <>
      <img
        src={season.seasonIcon}
        alt=""
        loading="lazy"
        height="24"
        width="24"
        className="h-6 w-6"
      />
      <span className="flex-1">{season.name.split(" ")[1]}</span>
    </>
  );
}
