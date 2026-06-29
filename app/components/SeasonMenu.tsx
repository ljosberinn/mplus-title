/**
 * Season switcher: a lightweight grouped dropdown keyed on the season
 * `expansion` field. SSR-safe — a controlled `<details>`-style
 * popover with click-outside + Escape handling, no client-only gate. Preserves
 * the `?params` passthrough, the disabled/selected logic, and adds
 * `prefetch="intent"` so hovering a season warms its loader.
 */
import clsx from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  NavLink,
  useNavigation,
  useParams,
  useSearchParams,
} from "react-router";

import { type Expansion, type Season, seasons } from "~/seasons";

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
  const { season: selectedSeasonSlug } = useParams();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const paramsAsString = params.toString() ? `?${params.toString()}` : "";

  const selectedSeason = seasons.find(
    (season) => season.slug === selectedSeasonSlug,
  );

  // close on outside click / Escape while open.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
        className="flex space-x-2 rounded-lg bg-gray-700 px-4 py-2 font-medium text-white outline-none ring-gray-500 transition-all duration-200 ease-in-out hover:bg-gray-500 focus:outline-none focus:ring-2"
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
          ▼
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-md bg-gray-700 shadow-lg"
        >
          {groups.map((group, groupIndex) => {
            const isFirstGroup = groupIndex === 0;
            const isLastGroup = groupIndex === groups.length - 1;

            return (
              <div key={group.expansion}>
                <span
                  className={clsx(
                    "inline-block w-full bg-gray-600 px-4 py-1 text-lg font-semibold text-white",
                    isFirstGroup && "rounded-t-lg",
                  )}
                >
                  {expansionLabel(group.expansion)}
                </span>
                <ul className="m-0 list-none p-0">
                  {group.seasons.map((season, index) => {
                    const isSelected = selectedSeason?.slug === season.slug;
                    const disabled =
                      isSelected ||
                      season.startDates.US === null ||
                      season.startDates.US > now ||
                      navigation.state !== "idle";

                    const isLast =
                      isLastGroup && index === group.seasons.length - 1;

                    return (
                      <li key={season.slug}>
                        {disabled ? (
                          <span
                            className={clsx(
                              "flex flex-1 items-center space-x-2 bg-gray-800 px-4 py-2 text-white outline-none grayscale transition-all duration-200 ease-in-out",
                              navigation.state === "idle"
                                ? "cursor-not-allowed"
                                : "cursor-wait",
                              isLast && "rounded-b-lg",
                            )}
                          >
                            <SeasonNavItemBody season={season} />
                            {isSelected && <span aria-hidden="true">✅</span>}
                          </span>
                        ) : (
                          <NavLink
                            role="menuitem"
                            prefetch="intent"
                            to={`/${season.slug}${paramsAsString}`}
                            onClick={() => {
                              setOpen(false);
                            }}
                            className={clsx(
                              "flex flex-1 items-center space-x-2 bg-gray-700 px-4 py-2 text-white outline-none transition-all duration-200 ease-in-out hover:bg-gray-500",
                              isLast && "rounded-b-lg",
                            )}
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
