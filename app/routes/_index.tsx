import { type ReactNode } from "react";
import { type LoaderFunction, Outlet, redirect } from "react-router";

import {
  determineOverlaysToDisplayFromCookies,
  determineRegionsToDisplayFromCookies,
} from "../load.server";
import { findSeasonByName } from "../seasons";
import { regionsToPathSegment, searchParamSeparator } from "../utils";

export const loader: LoaderFunction = ({ request }) => {
  const latest = findSeasonByName("latest", null);

  if (!latest) {
    throw new Error("Couldn't determine latest season.");
  }

  const overlays = determineOverlaysToDisplayFromCookies(request);

  const params = new URLSearchParams();

  if (overlays) {
    params.append("overlays", overlays.join(searchParamSeparator));
  }

  // Regions live in the path; the season view persists the last viewed selection
  // to a cookie (see `persistRegionsCookie`), so the landing page redirects back
  // to that region filter. An absent/"all" cookie collapses to the bare path.
  const regions = determineRegionsToDisplayFromCookies(request);
  const segment = regions ? regionsToPathSegment(regions) : "";

  const asString = params.toString();

  return redirect(
    `/${latest.slug}${segment ? `/${segment}` : ""}${asString ? `?${asString}` : ""}`,
    307,
  );
};

export default function Index(): ReactNode {
  return <Outlet />;
}
