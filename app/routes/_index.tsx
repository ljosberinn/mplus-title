import { type ReactNode } from "react";
import { type LoaderFunction, Outlet, redirect } from "react-router";

import { findSeasonByName } from "../seasons";

export const loader: LoaderFunction = () => {
  const latest = findSeasonByName("latest", null);

  if (!latest) {
    throw new Error("Couldn't determine latest season.");
  }

  // "/" is a cheap redirect into the latest season's bare path — the region
  // picker. No cookie read, no region segment, no data load: the picker is a
  // static render, so nothing here needs the expensive season payload.
  return redirect(`/${latest.slug}`, 307);
};

export default function Index(): ReactNode {
  return <Outlet />;
}
