import { type LoaderFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { findSeasonByName } from "~/seasons";

export const loader: LoaderFunction = () => {
  const latest = findSeasonByName("latest");

  if (!latest) {
    throw new Error("Couldn't determine latest season.");
  }

  return redirect(`/${latest.slug}`, 307);
};

export default function Index(): JSX.Element {
  return <Outlet />;
}
