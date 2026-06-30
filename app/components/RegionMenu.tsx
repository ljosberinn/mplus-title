import { type Regions } from "prisma/generated/prisma/enums";
import { type FormEventHandler, type ReactNode } from "react";
import { useRef } from "react";
import { useNavigate, useNavigation, useSearchParams } from "react-router";

import { type EnhancedSeason } from "~/seasons";
import { isNotNull, orderedRegionsBySize, regionsToPathSegment } from "~/utils";

import { linkClassName } from "./tokens";

type RegionToggleProps = {
  season: EnhancedSeason;
};

export function RegionToggle({ season }: RegionToggleProps): ReactNode {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state: navigationState } = useNavigation();

  const ref = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange: FormEventHandler<HTMLInputElement> = () => {
    // "disabled" checkboxes don't carry their value, so read the live checked
    // state off the refs. :BearWicked:
    const activeRegions = ref.current
      .filter(isNotNull)
      .filter((node) => node.checked)
      .map((node) => node.name as Regions);

    // never navigate to an empty region set (mirrors the last-region guard).
    if (activeRegions.length === 0) {
      return;
    }

    // regions now live in the path; "all selected" collapses to the bare path.
    // The query string (overlays, extrapolationEndDate) is preserved.
    const segment = regionsToPathSegment(activeRegions);
    const query = searchParams.toString();

    void navigate(
      `/${season.slug}${segment ? `/${segment}` : ""}${query ? `?${query}` : ""}`,
      { replace: true },
    );
  };

  return (
    <fieldset disabled={navigationState !== "idle"}>
      <ul className="flex flex-col space-y-2 md:flex-row md:space-x-2 md:space-y-0">
        {orderedRegionsBySize.map((region, index) => {
          const checked = season.score.regionsToDisplay.includes(region);
          const disabled =
            season.score.regionsToDisplay.length === 1 && checked;
          const base = linkClassName.replace("py-1", "").replace("px-2", "");

          return (
            <li
              key={region}
              className={`${
                disabled || navigationState !== "idle"
                  ? base
                      .replace("bg-gray-700", "bg-gray-800")
                      .replace(
                        "hover:bg-gray-500",
                        `${
                          disabled ? "cursor-not-allowed" : "cursor-wait"
                        } grayscale`,
                      )
                  : base
              }`}
            >
              <label
                className={`${disabled ? "cursor-not-allowed" : "cursor-pointer"} flex items-center gap-2 px-2 py-1`}
              >
                {region.toUpperCase()}

                <input
                  disabled={disabled}
                  type="checkbox"
                  className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
                  defaultChecked={checked}
                  aria-labelledby={`toggle-${region}`}
                  name={region}
                  ref={(node) => {
                    ref.current[index] = node;
                  }}
                  onChange={handleChange}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
