import { useNavigation, useSubmit } from "@remix-run/react";
import { useRef, FormEventHandler } from "react";
import { EnhancedSeason } from "~/seasons";
import { isNotNull, overlays, extraOverlayNames } from "~/utils";
import { linkClassName } from "./tokens";

type OverlaysToggleProps = {
  season: EnhancedSeason;
};

export function OverlaysToggle({ season }: OverlaysToggleProps) {
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
