/**
 * The chart feature toggles, grouped (Core / Extras / Other) inside a modal with
 * a short explanation per feature. Replaces the old inline `OverlaysToggle` row.
 * Persistence is unchanged: it submits the checked features to the `/overlays`
 * action (cookie + `?overlays=` round-trip) exactly like before. Only features
 * that apply to the current season are shown.
 */
import clsx from "clsx";
import { type FormEventHandler, type ReactNode, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { type EnhancedSeason } from "~/seasons";
import {
  featureGroups,
  featureMeta,
  type Overlay,
  overlays,
  searchParamSeparator,
} from "~/utils";

import { Modal } from "./Modal";

type ConfigureMenuProps = {
  season: EnhancedSeason;
};

export function ConfigureMenu({ season }: ConfigureMenuProps): ReactNode {
  // a fetcher (not a navigation submit) so posting to the `/overlays` resource
  // route doesn't try to GET-load it (it has no loader); the action's redirect
  // updates the URL + revalidates the chart.
  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);
  const refs = useRef<Partial<Record<Overlay, HTMLInputElement | null>>>({});

  // which score lines this season actually has, to hide toggles that'd be no-ops.
  const seriesIds = new Set<string>();
  for (const region of season.score.regionsToDisplay) {
    for (const s of season.score.series[region] ?? []) {
      if (typeof s.id === "string") {
        seriesIds.add(s.id);
      }
    }
  }

  const isAvailable = (overlay: Overlay): boolean => {
    // affix markers are only drawn for older seasons; modern seasons show them
    // in the header instead.
    if (overlay === "affixes") {
      return (season.wcl?.zoneId ?? 0) <= 39;
    }
    if (overlay === "extrapolation") {
      return season.supportsExtrapolationHistory;
    }
    if (overlay === "score" || overlay === "score100") {
      return seriesIds.has(overlay);
    }
    if (overlay === "mythicStats") {
      return season.startingPeriod !== null;
    }
    return true;
  };

  const handleChange: FormEventHandler<HTMLInputElement> = () => {
    // "disabled" checkboxes don't submit their value, so read the live checked
    // state off the refs (mirrors the old OverlaysToggle). :BearWicked:
    const formData = overlays.reduce((acc, overlay) => {
      if (refs.current[overlay]?.checked) {
        acc.set(overlay, "on");
      }
      return acc;
    }, new FormData());

    void fetcher.submit(formData, {
      action: "/overlays",
      method: "post",
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex cursor-pointer space-x-2 border border-gray-600 bg-gray-700 px-4 py-2 font-medium text-white outline-none ring-gray-500 transition-all duration-200 ease-in-out hover:bg-gray-500 focus:outline-none focus:ring-2"
      >
        Configure
      </button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Configure"
      >
        {/* uncontrolled checkboxes (`defaultChecked`); re-key on the resolved
            selection so external changes (back/forward) re-sync the DOM. */}
        <fieldset
          key={season.score.overlaysToDisplay.join(searchParamSeparator)}
          disabled={fetcher.state !== "idle"}
          className={clsx(fetcher.state !== "idle" && "opacity-60")}
        >
          <div className="flex flex-col gap-4">
            {featureGroups.map(({ group, label }) => {
              const items = overlays.filter(
                (overlay) =>
                  featureMeta[overlay].group === group && isAvailable(overlay),
              );

              if (items.length === 0) {
                return null;
              }

              return (
                <div key={group}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                    {label}
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {items.map((overlay) => {
                      const meta = featureMeta[overlay];
                      const checked =
                        season.score.overlaysToDisplay.includes(overlay);

                      return (
                        <li key={overlay} className="flex gap-2">
                          <input
                            type="checkbox"
                            id={`feature-${overlay}`}
                            name={overlay}
                            aria-label={meta.name}
                            className="mt-1 cursor-pointer"
                            defaultChecked={checked}
                            ref={(node) => {
                              refs.current[overlay] = node;
                            }}
                            onChange={handleChange}
                          />
                          <label
                            htmlFor={`feature-${overlay}`}
                            className="cursor-pointer"
                          >
                            <span className="font-medium">{meta.name}</span>
                            <span className="block text-sm text-stone-400">
                              {meta.description}
                            </span>
                            {meta.note ? (
                              <span className="block text-xs italic text-stone-400">
                                {meta.note}
                              </span>
                            ) : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </fieldset>
      </Modal>
    </>
  );
}
