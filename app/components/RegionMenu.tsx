import { useNavigation, useSubmit } from "@remix-run/react";
import { type FormEventHandler } from "react";
import { useRef } from "react";

import { type EnhancedSeason } from "~/seasons";
import { isNotNull, orderedRegionsBySize } from "~/utils";

import { linkClassName } from "./tokens";

type RegionToggleProps = {
  season: EnhancedSeason;
};

export function RegionToggle({ season }: RegionToggleProps): JSX.Element {
  const submit = useSubmit();
  const { state: navigationState } = useNavigation();

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
          const checked = season.score.regionsToDisplay.includes(region);
          const disabled = season.score.regionsToDisplay.length === 1 && checked;

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
                        } grayscale`,
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
