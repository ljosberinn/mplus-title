import type { LoaderFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

export const loader: LoaderFunction = () => {
  return redirect("/latest", 301);
};

export default function Index(): JSX.Element {
  return <Outlet />;
}
