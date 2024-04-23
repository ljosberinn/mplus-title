import { type LoaderFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import {
  determineOverlaysToDisplayFromCookies,
  determineRegionsToDisplayFromCookies,
} from "~/load.server";
import { findSeasonByName } from "~/seasons";
import { searchParamSeparator } from "~/utils";

export const loader: LoaderFunction = ({ request }) => {
  const overlays = determineOverlaysToDisplayFromCookies(request);
  const regions = determineRegionsToDisplayFromCookies(request);

  const params = new URLSearchParams();

  if (overlays) {
    params.append("overlays", overlays.join(searchParamSeparator));
  }

  if (regions) {
    params.append("regions", regions.join(searchParamSeparator));
  }

  const latest = findSeasonByName("latest", regions);

  if (!latest) {
    throw new Error("Couldn't determine latest season.");
  }

  const asString = params.toString();

  return redirect(`/${latest.slug}${asString ? `?${asString}` : ""}`, 307);
};

export default function Index(): JSX.Element {
  return <Outlet />;
}
