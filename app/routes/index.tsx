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
  const latest = findSeasonByName("latest");

  if (!latest) {
    throw new Error("Couldn't determine latest season.");
  }

  const overlays = determineOverlaysToDisplayFromCookies(request);
  const regions = determineRegionsToDisplayFromCookies(request);

  const params = new URLSearchParams();

  if (overlays) {
    params.append("overlays", overlays.join(searchParamSeparator));
  }

  if (regions) {
    params.append("regions", regions.join(searchParamSeparator));
  }

  const asString = params.toString();

  return redirect(
    `/season/${latest.slug}${asString ? `?${asString}` : ""}`,
    307,
  );
};

export default function Index(): JSX.Element {
  return <Outlet />;
}
