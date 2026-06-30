import { type ReactNode } from "react";
import { type LoaderFunction, Outlet, redirect } from "react-router";

import { determineOverlaysToDisplayFromCookies } from "../load.server";
import { findSeasonByName } from "../seasons";
import { searchParamSeparator } from "../utils";

export const loader: LoaderFunction = ({ request }) => {
  const overlays = determineOverlaysToDisplayFromCookies(request);

  const params = new URLSearchParams();

  if (overlays) {
    params.append("overlays", overlays.join(searchParamSeparator));
  }

  // Regions live in the path now and are no longer persisted in a cookie, so the
  // landing page always lands on the canonical "all regions" bare path and picks
  // the latest season across all regions.
  const latest = findSeasonByName("latest", null);

  if (!latest) {
    throw new Error("Couldn't determine latest season.");
  }

  const asString = params.toString();

  return redirect(`/${latest.slug}${asString ? `?${asString}` : ""}`, 307);
};

export default function Index(): ReactNode {
  return <Outlet />;
}
