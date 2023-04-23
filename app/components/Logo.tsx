import { NavLink } from "@remix-run/react";

export function Logo(): JSX.Element {
  return (
    <NavLink to="/" className="flex flex-row items-center space-x-4">
      <img
        src="/logo.webp"
        alt="Logo"
        height="48"
        width="48"
        className="h-12 w-12"
      />

      <span className="inline text-lg font-semibold tracking-tight">
        Title Cutoff Estimation
      </span>
    </NavLink>
  );
}
