import {
  NavLink,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "@remix-run/react";
import { Form, useLocation, useNavigate } from "@remix-run/react";
import { type FormEventHandler } from "react";
import { useEffect, useRef } from "react";

import { type EnhancedSeason } from "~/seasons";
import { seasons } from "~/seasons";
import {
  extraOverlayNames,
  isNotNull,
  orderedRegionsBySize,
  overlays,
} from "~/utils";

const linkClassName =
  "flex space-x-2 px-2 py-1 text-white transition-all duration-200 ease-in-out rounded-lg outline-none bg-gray-700 hover:bg-gray-500 focus:outline-none focus:ring-2 focus-ring-gray:500";
const activeLinkClassName = "underline bg-gray-500";

type CustomExtrapolationFormProps = {
  navigationState: ReturnType<typeof useNavigation>["state"];
  season: EnhancedSeason;
};
function CustomExtrapolationForm({
  navigationState,
  season,
}: CustomExtrapolationFormProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const ref = useRef<HTMLInputElement | null>(null);

  const customExtrapolationEndDate = (() => {
    try {
      const params = new URL(`https://dummy.com/${location.search}`)
        .searchParams;
      const maybeDate = params.get("extrapolationEndDate");

      return maybeDate ?? null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!customExtrapolationEndDate && ref.current) {
      ref.current.value = "";
    }
  }, [customExtrapolationEndDate]);

  const seasonHasStarted = Object.values(season.startDates).some(
    (maybeDate) => maybeDate !== null && maybeDate <= Date.now()
  );

  if (!seasonHasStarted) {
    return null;
  }

  const seasonHasEndedInEveryRegion = Object.values(season.endDates).every(
    (maybeDate) => maybeDate !== null && maybeDate <= Date.now()
  );

  const seasonHasEndingDate = seasonHasEndedInEveryRegion
    ? false
    : Object.values(season.endDates).every((maybeDate) => maybeDate !== null);

  if (seasonHasEndedInEveryRegion) {
    return null;
  }

  const disabled = seasonHasEndingDate || navigationState !== "idle";

  function createExtrapolationFormButtonClassName(disabled: boolean) {
    const base = linkClassName.replace("flex", "");

    return disabled
      ? linkClassName
          .replace("flex", "")
          .replace("bg-gray-700", "bg-gray-800")
          .replace(
            "hover:bg-gray-500",
            `${
              navigationState === "loading"
                ? "cursor-wait"
                : "cursor-not-allowed"
            } grayscale`
          )
      : base;
  }

  return (
    <>
      <div className="px-4 pt-4">
        <Form
          className="flex flex-col space-y-2 md:inline md:space-x-2 md:space-y-0"
          action={location.pathname}
        >
          <fieldset
            disabled={disabled}
            className="inline-flex  w-full justify-between space-x-2 md:w-auto"
          >
            <label
              className={
                seasonHasEndingDate
                  ? "w-full text-center italic md:text-left"
                  : ""
              }
              htmlFor="date"
              id="date-label"
            >
              Custom Extrapolation{" "}
              {seasonHasEndingDate ? "returns next season." : null}
            </label>
            <input
              aria-labelledby="date-label"
              id="date"
              ref={ref}
              className={`rounded-md border-0 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 sm:text-sm sm:leading-6 ${
                seasonHasEndingDate ? "hidden md:inline-block" : ""
              }`}
              type="date"
              min={new Date().toISOString().split("T")[0]}
              name="extrapolationEndDate"
              required
              disabled={seasonHasEndingDate}
              defaultValue={customExtrapolationEndDate ?? undefined}
            />
          </fieldset>

          <button
            disabled={disabled}
            type="submit"
            className={createExtrapolationFormButtonClassName(disabled)}
          >
            Extrapolate
          </button>
          <button
            disabled={disabled}
            className={createExtrapolationFormButtonClassName(
              disabled || !customExtrapolationEndDate
            )}
            type="reset"
            onClick={() => {
              navigate(window.location.pathname);
            }}
          >
            Reset
          </button>
        </Form>
      </div>
      {customExtrapolationEndDate ? (
        <div className="px-4 pt-4 text-white">
          <div className="flex flex-col rounded-lg bg-red-500 p-2 dark:bg-red-500/40 md:flex-row">
            <div className="flex justify-center" />
            <div className="p-2">
              <b>Warning</b>: you are using a custom extrapolation date. Use at
              your own risk; extrapolation is not perfect and will be inaccurate
              the further the date lies in the future.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type OverlaysToggleProps = CustomExtrapolationFormProps;

function OverlaysToggle({ navigationState, season }: OverlaysToggleProps) {
  const submit = useSubmit();

  const ref = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange: FormEventHandler<HTMLInputElement> = () => {
    // By default, "disabled" checkboxes won't have their values sent along when submitting a form. We're getting
    // around that by using refs to get the values. :BearWicked:
    const formData = ref.current
      .filter(isNotNull)
      .filter((ref) => ref.checked)
      .reduce((acc, ref) => {
        acc.set(ref.name, "on");
        return acc;
      }, new FormData());

    submit(formData, { action: "/overlays", method: "post", replace: true });
  };

  return (
    <fieldset disabled={navigationState !== "idle"}>
      <ul className="flex flex-col space-y-2 px-4 pt-4 md:flex-row md:space-x-2 md:space-y-0 md:px-0 md:pt-0">
        {overlays.map((overlay, index) => {
          const checked = season.overlaysToDisplay.includes(overlay);

          return (
            <li
              key={overlay}
              className={`${
                navigationState === "idle"
                  ? linkClassName
                  : linkClassName
                      .replace("bg-gray-700", "bg-gray-800")
                      .replace("hover:bg-gray-500", "cursor-wait grayscale")
              }`}
            >
              <label className="cursor-pointer" htmlFor={`toggle-${overlay}`}>
                {extraOverlayNames[overlay]}
              </label>

              <input
                type="checkbox"
                className="cursor-pointer"
                id={`toggle-${overlay}`}
                defaultChecked={checked}
                aria-labelledby={`toggle-${overlay}`}
                name={overlay}
                ref={(node) => {
                  ref.current[index] = node;
                }}
                onChange={handleChange}
              />
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

type RegionToggleProps = CustomExtrapolationFormProps;

function RegionToggle({ navigationState, season }: RegionToggleProps) {
  const submit = useSubmit();

  const ref = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange: FormEventHandler<HTMLInputElement> = () => {
    // By default, "disabled" checkboxes won't have their values sent along when submitting a form. We're getting
    // around that by using refs to get the values. :BearWicked:
    const formData = ref.current
      .filter(isNotNull)
      .filter((ref) => ref.checked)
      .reduce((acc, ref) => {
        acc.set(ref.name, "on");
        return acc;
      }, new FormData());

    submit(formData, { action: "/regions", method: "post", replace: true });
  };

  return (
    <fieldset disabled={navigationState !== "idle"}>
      <ul className="flex flex-col space-y-2 px-4 pt-4 md:flex-row md:space-x-2 md:space-y-0 md:px-0 md:pt-0">
        {orderedRegionsBySize.map((region, index) => {
          const checked = season.regionsToDisplay.includes(region);
          const disabled = season.regionsToDisplay.length === 1 && checked;

          return (
            <li
              key={region}
              className={`${
                disabled || navigationState !== "idle"
                  ? linkClassName
                      .replace("bg-gray-700", "bg-gray-800")
                      .replace(
                        "hover:bg-gray-500",
                        `${
                          disabled ? "cursor-not-allowed" : "cursor-wait"
                        } grayscale`
                      )
                  : linkClassName
              }`}
            >
              <label
                className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
                htmlFor={`toggle-${region}`}
              >
                {region.toUpperCase()}
              </label>

              <input
                disabled={disabled}
                type="checkbox"
                className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
                id={`toggle-${region}`}
                defaultChecked={checked}
                aria-labelledby={`toggle-${region}`}
                name={region}
                ref={(node) => {
                  ref.current[index] = node;
                }}
                onChange={handleChange}
              />
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function navLinkClassNameActivity({ isActive }: { isActive: boolean }) {
  return isActive ? `${linkClassName} ${activeLinkClassName}` : linkClassName;
}

type NavProps = {
  season: EnhancedSeason;
};
export function Nav({ season }: NavProps): JSX.Element {
  const now = Date.now();
  const navigation = useNavigation();
  const [params] = useSearchParams();

  const paramsAsString = params ? `?${params.toString()}` : "";

  return (
    <>
      <nav className="flex w-full flex-col flex-wrap justify-between gap-3 md:flex-row md:px-4">
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
                  <NavLink
                    className={navLinkClassNameActivity}
                    to={`/${season.slug}${paramsAsString}`}
                  >
                    {body}
                  </NavLink>
                ) : (
                  <span
                    className={linkClassName
                      .replace("bg-gray-700", "bg-gray-800")
                      .replace(
                        "hover:bg-gray-500",
                        `${
                          navigation.state === "idle"
                            ? "cursor-not-allowed"
                            : "cursor-wait"
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
        <RegionToggle navigationState={navigation.state} season={season} />
        <OverlaysToggle navigationState={navigation.state} season={season} />
      </nav>
      <CustomExtrapolationForm
        navigationState={navigation.state}
        season={season}
      />
    </>
  );
}
