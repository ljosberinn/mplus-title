import clsx from "clsx";
import { type ReactNode, useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";

import { type EnhancedSeason } from "~/seasons";

import { linkClassName } from "./tokens";

type CustomExtrapolationFormProps = {
  season: EnhancedSeason;
};

export default function CustomExtrapolationForm({
  season,
}: CustomExtrapolationFormProps): ReactNode | null {
  const location = useLocation();
  const navigate = useNavigate();
  const ref = useRef<HTMLInputElement | null>(null);
  const { state: navigationState } = useNavigation();

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
    (maybeDate) => maybeDate !== null && maybeDate <= Date.now(),
  );

  if (!seasonHasStarted) {
    return null;
  }

  const seasonHasEndedInEveryRegion = Object.values(season.endDates).every(
    (maybeDate) => maybeDate !== null && maybeDate <= Date.now(),
  );

  if (seasonHasEndedInEveryRegion) {
    return null;
  }

  const seasonHasEndingDate = seasonHasEndedInEveryRegion
    ? false
    : Object.values(season.endDates).every((maybeDate) => maybeDate !== null);

  const seasonIsLessThanFourWeeksOld = Object.values(season.startDates).some(
    (startDate) =>
      startDate !== null &&
      Date.now() - startDate < 4 * 7 * 24 * 60 * 60 * 1000,
  );

  const disabled =
    seasonHasEndingDate ||
    seasonIsLessThanFourWeeksOld ||
    navigationState !== "idle";

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
            } grayscale`,
          )
      : base;
  }

  return (
    <>
      <div className="px-4 pt-4">
        <form
          className="flex flex-col space-y-2 md:inline md:space-x-2 md:space-y-0"
          onSubmit={(event) => {
            event.preventDefault();
            if (ref.current) {
              const url = new URL(window.location.href);

              url.searchParams.delete("extrapolationEndDate");
              url.searchParams.append(
                "extrapolationEndDate",
                ref.current.value,
              );

              navigate(window.location.pathname + url.search);
            }
          }}
        >
          <fieldset
            disabled={disabled}
            className="inline-flex w-full justify-between space-x-2 md:w-auto"
          >
            <label
              className={
                seasonHasEndingDate
                  ? "w-full text-center italic md:text-left"
                  : undefined
              }
              htmlFor="date"
              id="date-label"
            >
              Custom Extrapolation{" "}
              {seasonHasEndingDate
                ? "returns next season."
                : seasonIsLessThanFourWeeksOld
                  ? "becomes available after week 4."
                  : null}
            </label>
            <input
              aria-labelledby="date-label"
              id="date"
              ref={ref}
              className={clsx(
                "rounded-md border-0 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 sm:text-sm sm:leading-6",
                seasonHasEndingDate && "hidden md:inline-block",
              )}
              type="date"
              min={new Date().toISOString().split("T")[0]}
              name="extrapolationEndDate"
              required
              disabled={seasonHasEndingDate || seasonIsLessThanFourWeeksOld}
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
              disabled || !customExtrapolationEndDate,
            )}
            type="reset"
            onClick={() => {
              navigate(window.location.pathname);
            }}
          >
            Reset
          </button>
        </form>
      </div>
      {!disabled && customExtrapolationEndDate ? (
        <div className="px-4 pt-4 text-white">
          <div className="flex flex-col rounded-lg bg-red-500 p-2 md:flex-row dark:bg-red-500/40">
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
